import { createClient } from '@supabase/supabase-js'
import { buildInvoice, buildReport, buildSigCache } from './_pdf.js'

export const config = { maxDuration: 60 }

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const ANON_KEY     = process.env.VITE_SUPABASE_ANON_KEY
const CRON_SECRET  = process.env.CRON_SECRET

// Compute current week bounds (Sun–Sat) in ET
function getWeekBoundsET() {
  const now = new Date()
  const etStr = now.toLocaleString('en-US', { timeZone: 'America/New_York' })
  const et = new Date(etStr)
  const day = et.getDay()
  const sunday = new Date(et)
  sunday.setDate(et.getDate() - day)
  const saturday = new Date(sunday)
  saturday.setDate(sunday.getDate() + 6)
  const fmt = d => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${dd}`
  }
  return { weekStart: fmt(sunday), weekEnd: fmt(saturday) }
}

function etDateToUTC(dateStr, endOfDay = false) {
  const noonUTC = new Date(`${dateStr}T12:00:00Z`)
  const etHour = parseInt(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', hour12: false }).format(noonUTC)
  )
  const offsetHours = 12 - etHour
  const midnight = new Date(new Date(`${dateStr}T00:00:00Z`).getTime() + offsetHours * 3_600_000)
  return endOfDay ? new Date(midnight.getTime() + 86_399_999).toISOString() : midnight.toISOString()
}

export default async function handler(req, res) {
  const auth = req.headers.authorization || ''
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const { weekStart, weekEnd } = getWeekBoundsET()
    const queryStart = etDateToUTC(weekStart, false)
    const queryEnd   = etDateToUTC(weekEnd, true)

    const supabase = createClient(SUPABASE_URL, ANON_KEY)

    // Load settings
    const { data: sRows } = await supabase.from('settings').select('key, value')
    const settings = {}
    ;(sRows || []).forEach(r => (settings[r.key] = r.value))

    // Query trips
    const { data: trips, error: tripsErr } = await supabase
      .from('trips')
      .select('*, drivers(name), riders(name), rate_differential')
      .eq('status', 'completed')
      .gte('created_at', queryStart)
      .lte('created_at', queryEnd)
      .order('trip_number')
    if (tripsErr) throw tripsErr
    if (!trips?.length) return res.json({ skipped: true, reason: 'No completed trips this week', week_start: weekStart })

    const sigCache    = await buildSigCache(trips)
    const totalAmt    = trips.reduce((s, t) => s + (t.trip_total  || 0), 0)
    const totalRiders = trips.reduce((s, t) => s + (t.rider_count || 1), 0)

    // Get or create invoice record first (need invoice_number for the PDF)
    const { data: rpcResult, error: rpcErr } = await supabase
      .rpc('upsert_invoice_cron', {
        p_week_start:   weekStart,
        p_week_end:     weekEnd,
        p_total_rides:  trips.length,
        p_total_riders: totalRiders,
        p_total_amount: totalAmt,
        p_pdf_url:      null,
        p_report_url:   null,
      })
    if (rpcErr) throw rpcErr
    const { invoice_number: invoiceNumber } = rpcResult

    // Build both PDFs in parallel
    const [invoiceDoc, reportDoc] = await Promise.all([
      buildInvoice(trips, settings, sigCache, weekStart, weekEnd, invoiceNumber),
      buildReport(trips, settings, sigCache, weekStart, weekEnd, 'Weekly Driver Report'),
    ])
    const [invoiceBytes, reportBytes] = await Promise.all([
      invoiceDoc.save(),
      reportDoc.save(),
    ])

    // Upload both in parallel
    const iPath = `weekly/invoice-${weekStart}-to-${weekEnd}.pdf`
    const rPath = `weekly/report-${weekStart}-to-${weekEnd}.pdf`
    const [iUp, rUp] = await Promise.all([
      supabase.storage.from('pdfs').upload(iPath, invoiceBytes, { contentType: 'application/pdf', upsert: true }),
      supabase.storage.from('pdfs').upload(rPath, reportBytes,  { contentType: 'application/pdf', upsert: true }),
    ])
    if (iUp.error) throw iUp.error
    if (rUp.error) throw rUp.error

    const { data: iUrl } = supabase.storage.from('pdfs').getPublicUrl(iPath)
    const { data: rUrl } = supabase.storage.from('pdfs').getPublicUrl(rPath)

    // Save both URLs to the invoice record
    await supabase.rpc('upsert_invoice_cron', {
      p_week_start:   weekStart,
      p_week_end:     weekEnd,
      p_total_rides:  trips.length,
      p_total_riders: totalRiders,
      p_total_amount: totalAmt,
      p_pdf_url:      iUrl.publicUrl,
      p_report_url:   rUrl.publicUrl,
    })

    return res.json({
      generated:      true,
      week_start:     weekStart,
      week_end:       weekEnd,
      invoice_number: invoiceNumber,
      invoice_url:    iUrl.publicUrl,
      report_url:     rUrl.publicUrl,
      total_rides:    trips.length,
      total_amount:   totalAmt,
    })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: e.message || 'Internal error' })
  }
}

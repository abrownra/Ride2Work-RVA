import { createClient } from '@supabase/supabase-js'
import { buildInvoice, buildReport, buildSigCache } from './_pdf.js'

export const config = { maxDuration: 60 }

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const ANON_KEY     = process.env.VITE_SUPABASE_ANON_KEY

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type, apikey')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    // Verify admin session
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) return res.status(401).json({ error: 'Unauthorized' })

    const supabase = createClient(SUPABASE_URL, ANON_KEY)
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })

    const { week_start, week_end, date_start, date_end, report_only, report_title, range_start, range_end } = req.body

    const rangeStart = date_start || week_start
    const rangeEnd   = date_end   || week_end
    if (!rangeStart || !rangeEnd) return res.status(400).json({ error: 'date_start and date_end required' })

    const queryStart = range_start || `${rangeStart}T00:00:00.000Z`
    const queryEnd   = range_end   || `${rangeEnd}T23:59:59.999Z`

    // Load settings (public read)
    const { data: sRows } = await supabase.from('settings').select('key, value')
    const settings = {}
    ;(sRows || []).forEach(r => (settings[r.key] = r.value))

    // Query trips (public read)
    const { data: trips, error: tripsErr } = await supabase
      .from('trips')
      .select('*, drivers(name), riders(name), rate_differential')
      .eq('status', 'completed')
      .gte('created_at', queryStart)
      .lte('created_at', queryEnd)
      .order('trip_number')
    if (tripsErr) throw tripsErr
    if (!trips?.length) return res.status(400).json({ error: 'No completed trips found for this period' })

    // Prefetch all signatures in parallel
    const sigCache    = await buildSigCache(trips)
    const totalAmt    = trips.reduce((s, t) => s + (t.trip_total  || 0), 0)
    const totalRiders = trips.reduce((s, t) => s + (t.rider_count || 1), 0)

    // ── Report only: return PDF bytes directly ──
    if (report_only) {
      const title = report_title || 'Driver Report'
      const doc   = await buildReport(trips, settings, sigCache, rangeStart, rangeEnd, title)
      const bytes = await doc.save()
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="report-${rangeStart}-${rangeEnd}.pdf"`)
      return res.send(Buffer.from(bytes))
    }

    // ── Invoice: upsert via SECURITY DEFINER RPC (bypasses RLS), upload PDFs ──
    const { data: rpcResult, error: rpcErr } = await supabase
      .rpc('upsert_invoice_cron', {
        p_week_start:   rangeStart,
        p_week_end:     rangeEnd,
        p_total_rides:  trips.length,
        p_total_riders: totalRiders,
        p_total_amount: totalAmt,
        p_pdf_url:      null,
        p_report_url:   null,
      })
    if (rpcErr) throw rpcErr
    const { id: invoiceId, invoice_number: invoiceNumber } = rpcResult

    // Build both PDFs in parallel
    const [invoiceDoc, reportDoc] = await Promise.all([
      buildInvoice(trips, settings, sigCache, rangeStart, rangeEnd, invoiceNumber),
      buildReport(trips, settings, sigCache, rangeStart, rangeEnd, 'Weekly Driver Report'),
    ])
    const [invoiceBytes, reportBytes] = await Promise.all([
      invoiceDoc.save(),
      reportDoc.save(),
    ])

    // Upload both in parallel (storage INSERT policy has no auth requirement)
    const iPath = `weekly/invoice-${rangeStart}-to-${rangeEnd}.pdf`
    const rPath = `weekly/report-${rangeStart}-to-${rangeEnd}.pdf`
    const [iUp, rUp] = await Promise.all([
      supabase.storage.from('pdfs').upload(iPath, invoiceBytes, { contentType: 'application/pdf', upsert: true }),
      supabase.storage.from('pdfs').upload(rPath, reportBytes,  { contentType: 'application/pdf', upsert: true }),
    ])
    if (iUp.error) throw iUp.error
    if (rUp.error) throw rUp.error

    const { data: iUrl } = supabase.storage.from('pdfs').getPublicUrl(iPath)
    const { data: rUrl } = supabase.storage.from('pdfs').getPublicUrl(rPath)

    // Save both URLs via RPC
    await supabase.rpc('upsert_invoice_cron', {
      p_week_start:   rangeStart,
      p_week_end:     rangeEnd,
      p_total_rides:  trips.length,
      p_total_riders: totalRiders,
      p_total_amount: totalAmt,
      p_pdf_url:      iUrl.publicUrl,
      p_report_url:   rUrl.publicUrl,
    })

    return res.json({
      invoice_id:     invoiceId,
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

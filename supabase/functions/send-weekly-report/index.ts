import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function toLocalDate(d: Date): string {
  const et = new Date(d.toLocaleString("en-US", { timeZone: "America/New_York" }))
  const y = et.getFullYear()
  const m = String(et.getMonth() + 1).padStart(2, "0")
  const day = String(et.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function etDateToUTC(dateStr: string, endOfDay = false): string {
  const noonUTC = new Date(`${dateStr}T12:00:00Z`)
  const etHour = parseInt(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", hour12: false }).format(noonUTC)
  )
  const offsetHours = 12 - etHour
  const midnightET = new Date(new Date(`${dateStr}T00:00:00Z`).getTime() + offsetHours * 3_600_000)
  if (!endOfDay) return midnightET.toISOString()
  return new Date(midnightET.getTime() + 86_399_999).toISOString()
}

function fmtDate(s: string): string {
  return new Date(s + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
}

function fmtC(n: number): string {
  return "$" + Number(n).toFixed(2)
}

function toB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ""
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // Cron fires Sunday 3am UTC = Saturday 10pm ET
    const now = new Date()
    const sat = new Date(now)
    const sun = new Date(now)
    sun.setDate(sun.getDate() - 7)
    const weekStart = toLocalDate(sun)
    const weekEnd = toLocalDate(sat)

    const rangeStart = etDateToUTC(weekStart, false)
    const rangeEnd   = etDateToUTC(weekEnd, true)

    // Look up invoice record for this week (admin generates it via the portal)
    const { data: invoiceRow } = await supabase
      .from("invoices")
      .select("*")
      .gte("week_start", weekStart)
      .lte("week_end", weekEnd)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    // Load settings + private settings
    const { data: sRows } = await supabase.from("settings").select("key, value")
    const settings: Record<string, string> = {}
    ;(sRows || []).forEach((r: any) => (settings[r.key] = r.value))

    const { data: pRows } = await supabase.from("private_settings").select("key, value")
    const priv: Record<string, string> = {}
    ;(pRows || []).forEach((r: any) => (priv[r.key] = r.value))

    const apiKey = priv.resend_api_key
    const fromEmail = priv.resend_from_email || "onboarding@resend.dev"
    const replyTo = priv.resend_reply_to

    if (!apiKey) throw new Error("Resend API key not configured")

    const recipients = [
      settings.admin_email,
      settings.report_recipient_1,
      settings.report_recipient_2,
      settings.report_recipient_3,
    ].filter(Boolean) as string[]

    if (!recipients.length) throw new Error("No recipients configured in settings")

    const periodStr = `${fmtDate(weekStart)} \u2013 ${fmtDate(weekEnd)}`

    // Build email — attach invoice PDF if available, otherwise prompt admin to generate
    const attachments: any[] = []
    let summaryHtml = ""

    if (invoiceRow?.pdf_url) {
      const pdfRes = await fetch(invoiceRow.pdf_url)
      if (pdfRes.ok) {
        const pdfB64 = toB64(await pdfRes.arrayBuffer())
        attachments.push({ filename: `invoice-${weekStart}.pdf`, content: pdfB64 })
      }
      if (invoiceRow.report_url) {
        const reportRes = await fetch(invoiceRow.report_url)
        if (reportRes.ok) {
          const reportB64 = toB64(await reportRes.arrayBuffer())
          attachments.push({ filename: `report-${weekStart}.pdf`, content: reportB64 })
        }
      }
      summaryHtml = `
        <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px;margin-bottom:20px">
          <p style="margin:0 0 6px;color:#0369a1"><strong>Total Trips:</strong> ${invoiceRow.total_rides ?? "—"}</p>
          <p style="margin:0 0 6px;color:#0369a1"><strong>Total Riders:</strong> ${invoiceRow.total_riders ?? "—"}</p>
          <p style="margin:0;color:#0369a1"><strong>Total Amount:</strong> ${invoiceRow.total_amount != null ? fmtC(invoiceRow.total_amount) : "—"}</p>
        </div>
      `
    } else {
      summaryHtml = `
        <div style="background:#fff7ed;border:1px solid #fdba74;border-radius:8px;padding:16px;margin-bottom:20px">
          <p style="margin:0;color:#c2410c"><strong>No invoice was generated this week.</strong> Please log into the admin portal and generate the invoice PDF, then send manually.</p>
        </div>
      `
    }

    // Mark invoice as sent
    if (invoiceRow?.id) {
      await supabase.from("invoices").update({ sent_at: new Date().toISOString() }).eq("id", invoiceRow.id)
    }

    const emailPayload: any = {
      from: fromEmail,
      to: recipients,
      subject: `Weekly Invoice \u2014 ${periodStr}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
          <h2 style="color:#1a56db;margin:0 0 8px">Weekly Invoice</h2>
          <p style="color:#374151;margin:0 0 16px">Period: <strong>${periodStr}</strong></p>
          ${summaryHtml}
          <p style="color:#6b7280;font-size:0.9rem">${attachments.length ? "Invoice PDF attached." : "No PDF available — please generate from the admin portal."}</p>
        </div>
      `,
    }
    if (replyTo) emailPayload.reply_to = replyTo
    if (attachments.length) emailPayload.attachments = attachments

    const emailResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(emailPayload),
    })

    if (!emailResp.ok) {
      const errText = await emailResp.text()
      throw new Error(`Resend error: ${errText}`)
    }

    return new Response(
      JSON.stringify({ sent: true, recipients, period: periodStr, has_pdf: attachments.length > 0 }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )
  } catch (e: any) {
    console.error(e)
    return new Response(
      JSON.stringify({ error: e.message || "Internal error" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    )
  }
})

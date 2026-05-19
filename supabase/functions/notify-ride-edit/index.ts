import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function fmtDateTime(ts: string): string {
  return new Date(ts).toLocaleString("en-US", {
    weekday: "long", month: "long", day: "numeric",
    hour: "numeric", minute: "2-digit",
    timeZone: "America/New_York",
  })
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  try {
    const { ride_request_id, change_type } = await req.json()
    // change_type: 'edited' | 'cancelled'
    if (!ride_request_id) throw new Error("ride_request_id required")

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const { data: ride } = await supabase
      .from("ride_requests")
      .select("*, riders(name, phone), drivers(name, email)")
      .eq("id", ride_request_id)
      .single()

    if (!ride) throw new Error("Ride not found")

    const { data: privRows } = await supabase.from("private_settings").select("key, value")
    const priv: Record<string, string> = {}
    ;(privRows || []).forEach((r: any) => (priv[r.key] = r.value))

    const { data: sRows } = await supabase.from("settings").select("key, value")
    const settings: Record<string, string> = {}
    ;(sRows || []).forEach((r: any) => (settings[r.key] = r.value))

    const apiKey   = priv.resend_api_key
    const fromEmail = priv.resend_from_email || "noreply@ridestoworkrva.online"
    const adminEmail = settings.admin_email
    if (!apiKey) throw new Error("Resend API key not configured")

    const riderName  = ride.riders?.name || "A rider"
    const driverName = ride.drivers?.name || "your driver"
    const driverEmail = ride.drivers?.email
    const pickupTime = fmtDateTime(ride.pickup_time)
    const isCancelled = change_type === "cancelled"

    const subject = isCancelled
      ? `Ride Cancelled \u2014 ${riderName} \u2014 ${pickupTime}`
      : `Ride Updated \u2014 ${riderName} \u2014 ${pickupTime}`

    const statusColor = isCancelled ? "#b91c1c" : "#d97706"
    const statusBg    = isCancelled ? "#fef2f2" : "#fefce8"
    const statusLabel = isCancelled ? "CANCELLED" : "UPDATED"

    const html = `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <h2 style="color:${statusColor};margin:0 0 8px">${statusLabel}: Ride ${isCancelled ? "Cancelled" : "Modified"}</h2>
        <p style="color:#374151;margin:0 0 20px">${riderName} has ${isCancelled ? "cancelled" : "modified"} a scheduled ride.</p>
        <div style="background:${statusBg};border:1px solid;border-color:${statusColor};border-radius:8px;padding:16px;margin-bottom:20px">
          <p style="margin:0 0 8px;color:#1f2937"><strong>Rider:</strong> ${riderName}</p>
          <p style="margin:0 0 8px;color:#1f2937"><strong>Pickup Time:</strong> ${pickupTime}</p>
          <p style="margin:0 0 8px;color:#1f2937"><strong>Pickup:</strong> ${ride.pickup_address}</p>
          <p style="margin:0 0 8px;color:#1f2937"><strong>Drop-off:</strong> ${ride.dropoff_address}</p>
          <p style="margin:0;color:#1f2937"><strong>Status:</strong> ${ride.status}</p>
        </div>
        ${!isCancelled && driverName ? `<p style="color:#374151">If these changes don't work for you, you can release this ride back to the pool from the driver app.</p>` : ""}
        ${isCancelled ? `<p style="color:#374151">This ride has been removed. If you had already claimed it, no action is needed — it has been voided.</p>` : ""}
      </div>
    `

    const to = [adminEmail, driverEmail].filter(Boolean) as string[]
    if (!to.length) throw new Error("No recipients")

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from: fromEmail, to, subject, html }),
    })

    return new Response(JSON.stringify({ sent: true }), { headers: { ...cors, "Content-Type": "application/json" } })
  } catch (e: any) {
    console.error(e)
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } })
  }
})

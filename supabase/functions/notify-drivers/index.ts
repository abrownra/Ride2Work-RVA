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
    const { ride_request_id } = await req.json()
    if (!ride_request_id) throw new Error("ride_request_id required")

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // Fetch ride request + rider info
    const { data: ride, error: rideErr } = await supabase
      .from("ride_requests")
      .select("*, riders(name, phone)")
      .eq("id", ride_request_id)
      .single()

    if (rideErr || !ride) throw new Error("Ride request not found")

    // Fetch all active drivers with emails
    const { data: drivers } = await supabase
      .from("drivers")
      .select("name, email")
      .eq("active", true)
      .not("email", "is", null)

    if (!drivers?.length) throw new Error("No drivers with email found")

    // Fetch Resend credentials
    const { data: privRows } = await supabase
      .from("private_settings")
      .select("key, value")
    const priv: Record<string, string> = {}
    ;(privRows || []).forEach((r: any) => (priv[r.key] = r.value))

    const apiKey = priv.resend_api_key
    const fromEmail = priv.resend_from_email || "noreply@ridestoworkrva.online"
    if (!apiKey) throw new Error("Resend API key not configured")

    const riderName = ride.riders?.name || "A rider"
    const pickupTime = fmtDateTime(ride.pickup_time)
    const appUrl = "https://ride2-work-rva.vercel.app"

    const to = drivers.map((d: any) => d.email)

    const emailResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to,
        subject: `New Ride Request — ${riderName} — ${pickupTime}`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
            <h2 style="color:#16a34a;margin:0 0 8px">New Ride Available</h2>
            <p style="color:#374151;margin:0 0 20px">A rider has requested a pickup. Claim it first to secure the trip.</p>

            <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:16px;margin-bottom:20px">
              <p style="margin:0 0 8px;color:#15803d"><strong>Rider:</strong> ${riderName}</p>
              <p style="margin:0 0 8px;color:#15803d"><strong>Pickup Time:</strong> ${pickupTime}</p>
              <p style="margin:0 0 8px;color:#15803d"><strong>Pickup:</strong> ${ride.pickup_address}</p>
              <p style="margin:0;color:#15803d"><strong>Drop-off:</strong> ${ride.dropoff_address}</p>
              ${ride.notes ? `<p style="margin:8px 0 0;color:#15803d"><strong>Notes:</strong> ${ride.notes}</p>` : ""}
            </div>

            <a href="${appUrl}" style="display:inline-block;background:#16a34a;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:1rem">
              Open App to Claim
            </a>

            <p style="color:#9ca3af;font-size:0.8rem;margin-top:20px">First driver to claim gets the ride. Open the app now.</p>
          </div>
        `,
      }),
    })

    if (!emailResp.ok) {
      const errText = await emailResp.text()
      throw new Error(`Resend error: ${errText}`)
    }

    return new Response(
      JSON.stringify({ sent: true, driver_count: to.length }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )
  } catch (e: any) {
    console.error(e)
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    )
  }
})

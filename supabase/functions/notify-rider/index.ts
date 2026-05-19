import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  try {
    const { trip_id } = await req.json()
    if (!trip_id) throw new Error("trip_id required")

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    )

    const { data: trip, error: tripErr } = await supabase
      .from("trips")
      .select("id, drivers(name), riders(name, email)")
      .eq("id", trip_id)
      .single()

    if (tripErr) throw tripErr

    const riderEmail = trip.riders?.email
    const riderName  = trip.riders?.name  || "Rider"
    const driverName = trip.drivers?.name || "Your driver"

    if (!riderEmail) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "Rider has no email on file" }),
        { headers: { ...cors, "Content-Type": "application/json" } },
      )
    }

    const { data: ps } = await supabase
      .from("private_settings")
      .select("key, value")
      .in("key", ["resend_api_key", "resend_from_email", "resend_reply_to"])

    const cfg: Record<string, string> = {}
    ;(ps || []).forEach((r: any) => (cfg[r.key] = r.value))

    const apiKey  = cfg.resend_api_key
    const from    = cfg.resend_from_email || "onboarding@resend.dev"
    const replyTo = cfg.resend_reply_to

    if (!apiKey) throw new Error("resend_api_key not set in Notification Settings")

    const payload: Record<string, unknown> = {
      from,
      to: [riderEmail],
      subject: `${driverName} has arrived!`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:24px;">
          <div style="background:#1a56db;border-radius:12px;padding:24px;margin-bottom:24px;">
            <h1 style="color:#fff;margin:0;font-size:1.5rem;">Your ride is here!</h1>
          </div>
          <p style="font-size:1.05rem;color:#374151;line-height:1.7;margin-bottom:20px;">
            Hi <strong>${riderName}</strong>,<br><br>
            <strong>${driverName}</strong> has arrived and is waiting outside for you.
            Please head out when you're ready!
          </p>
          <div style="background:#f3f4f6;border-radius:10px;padding:16px;font-size:0.82rem;color:#9ca3af;">
            Free Rides To Work &mdash; Ride2Work RVA
          </div>
        </div>
      `,
    }

    if (replyTo) payload.reply_to = replyTo

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Resend: ${body}`)
    }

    const result = await res.json()
    console.log("Notification sent:", result.id, "->", riderEmail)

    return new Response(
      JSON.stringify({ sent: true, email: riderEmail }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    )

  } catch (e: any) {
    console.error(e)
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    )
  }
})

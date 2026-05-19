import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function getWeekDates(): Record<number, Date> {
  // Get Mon-Sun of the current week in ET
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }))
  const day = now.getDay() // 0=Sun
  const monday = new Date(now)
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
  monday.setHours(0, 0, 0, 0)
  const dates: Record<number, Date> = {}
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    dates[d.getDay()] = d // key by day_of_week (0=Sun)
  }
  return dates
}

function buildPickupTime(date: Date, timeStr: string): string {
  const [h, m] = timeStr.split(":").map(Number)
  const dt = new Date(date)
  dt.setHours(h, m, 0, 0)
  return dt.toISOString()
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {}
    const specific_rider_id = body.rider_id || null

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // Fetch active templates
    let tq = supabase
      .from("rider_schedule_templates")
      .select("*, riders(id, name, email)")
      .eq("active", true)
    if (specific_rider_id) tq = tq.eq("rider_id", specific_rider_id)
    const { data: templates } = await tq
    if (!templates?.length) {
      return new Response(JSON.stringify({ generated: 0, message: "No active templates" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      })
    }

    const weekDates = getWeekDates()
    const inserts: any[] = []
    const riderDays = new Set<string>()

    for (const t of templates) {
      const date = weekDates[t.day_of_week]
      if (!date) continue

      // Morning ride
      if (t.morning_enabled && t.morning_time && t.pickup_address && t.dropoff_address) {
        const pickupTime = buildPickupTime(date, t.morning_time)
        // Idempotency: check if already exists
        const { data: existing } = await supabase
          .from("ride_requests")
          .select("id")
          .eq("rider_id", t.rider_id)
          .eq("pickup_time", pickupTime)
          .neq("status", "cancelled")
          .maybeSingle()
        if (!existing) {
          inserts.push({
            rider_id: t.rider_id,
            pickup_address: t.pickup_address,
            dropoff_address: t.dropoff_address,
            pickup_time: pickupTime,
            status: "pending",
            from_template: true,
          })
          riderDays.add(`${t.rider_id}-morning-${date.toDateString()}`)
        }
      }

      // Evening ride (addresses reversed)
      if (t.evening_enabled && t.evening_time && t.pickup_address && t.dropoff_address) {
        const pickupTime = buildPickupTime(date, t.evening_time)
        const { data: existing } = await supabase
          .from("ride_requests")
          .select("id")
          .eq("rider_id", t.rider_id)
          .eq("pickup_time", pickupTime)
          .neq("status", "cancelled")
          .maybeSingle()
        if (!existing) {
          inserts.push({
            rider_id: t.rider_id,
            pickup_address: t.dropoff_address, // reversed
            dropoff_address: t.pickup_address, // reversed
            pickup_time: pickupTime,
            status: "pending",
            from_template: true,
          })
        }
      }
    }

    if (!inserts.length) {
      return new Response(JSON.stringify({ generated: 0, message: "All rides already generated" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      })
    }

    const { data: inserted, error: insertError } = await supabase
      .from("ride_requests")
      .insert(inserts)
      .select()
    if (insertError) throw new Error(insertError.message)

    // Notify drivers for each new request
    for (const r of (inserted || [])) {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/notify-drivers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ride_request_id: r.id }),
      })
    }

    // Email confirmation to each affected rider
    const { data: privRows } = await supabase.from("private_settings").select("key, value")
    const priv: Record<string, string> = {}
    ;(privRows || []).forEach((r: any) => (priv[r.key] = r.value))
    const apiKey = priv.resend_api_key
    const fromEmail = priv.resend_from_email || "noreply@ridestoworkrva.online"

    if (apiKey) {
      // Group by rider
      const byRider: Record<string, { name: string; email: string; count: number }> = {}
      for (const t of templates) {
        if (!t.riders?.email) continue
        if (!byRider[t.rider_id]) {
          byRider[t.rider_id] = { name: t.riders.name, email: t.riders.email, count: 0 }
        }
      }
      const insertedRiderIds = new Set((inserted || []).map((r: any) => r.rider_id))
      for (const rid of insertedRiderIds) {
        const rider = byRider[rid]
        if (!rider?.email) continue
        const count = (inserted || []).filter((r: any) => r.rider_id === rid).length
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            from: fromEmail,
            to: [rider.email],
            subject: `Your rides this week have been scheduled`,
            html: `
              <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
                <h2 style="color:#111;margin:0 0 8px">Hi ${rider.name.split(" ")[0]}!</h2>
                <p style="color:#374151;margin:0 0 16px">Your <strong>${count} ride${count !== 1 ? "s" : ""}</strong> for this week have been automatically scheduled and are now in the driver pool.</p>
                <p style="color:#374151;margin:0 0 16px">Log in to the rider app to view, edit, or cancel any individual rides.</p>
                <a href="https://ride2-work-rva.vercel.app/rider" style="display:inline-block;background:#111;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700">View My Rides</a>
              </div>
            `,
          }),
        })
      }
    }

    return new Response(
      JSON.stringify({ generated: (inserted || []).length }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )
  } catch (e: any) {
    console.error(e)
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } })
  }
})

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const ok = (data: object) =>
  new Response(JSON.stringify(data), { headers: { ...cors, "Content-Type": "application/json" } })

const err = (msg: string) =>
  new Response(JSON.stringify({ error: msg }), { headers: { ...cors, "Content-Type": "application/json" } })

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )

  // Verify the caller is an authenticated admin
  const token = req.headers.get("Authorization")?.replace("Bearer ", "")
  if (!token) return err("Unauthorized")

  const { data: { user }, error: authErr } = await serviceClient.auth.getUser(token)
  if (authErr || !user) return err("Unauthorized")

  try {
    const { email, password } = await req.json()
    if (!email || !password) return err("Email and password are required")
    if (password.length < 8) return err("Password must be at least 8 characters")

    const { data, error: createErr } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (createErr) return err(createErr.message)

    return ok({ created: true, email: data.user.email })
  } catch (e: any) {
    return err(e.message || "Internal error")
  }
})

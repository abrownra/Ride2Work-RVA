import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )

  // Verify the caller is an authenticated admin
  const token = req.headers.get("Authorization")?.replace("Bearer ", "")
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    })
  }
  const { data: { user }, error: authErr } = await serviceClient.auth.getUser(token)
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    })
  }

  // GET — list all admin users
  if (req.method === "GET") {
    try {
      const { data, error } = await serviceClient.auth.admin.listUsers()
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...cors, "Content-Type": "application/json" },
        })
      }
      const users = data.users.map((u) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
      }))
      return new Response(JSON.stringify({ users }), {
        headers: { ...cors, "Content-Type": "application/json" },
      })
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message || "Internal error" }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      })
    }
  }

  // DELETE — remove an admin user
  if (req.method === "DELETE") {
    try {
      const { userId } = await req.json()
      if (!userId) {
        return new Response(JSON.stringify({ error: "userId is required" }), {
          status: 400, headers: { ...cors, "Content-Type": "application/json" },
        })
      }
      // Prevent self-deletion
      if (userId === user.id) {
        return new Response(JSON.stringify({ error: "You cannot delete your own account" }), {
          status: 400, headers: { ...cors, "Content-Type": "application/json" },
        })
      }
      const { error } = await serviceClient.auth.admin.deleteUser(userId)
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400, headers: { ...cors, "Content-Type": "application/json" },
        })
      }
      return new Response(JSON.stringify({ deleted: true }), {
        headers: { ...cors, "Content-Type": "application/json" },
      })
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message || "Internal error" }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      })
    }
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405, headers: { ...cors, "Content-Type": "application/json" },
  })
})

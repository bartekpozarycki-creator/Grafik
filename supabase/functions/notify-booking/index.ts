import { createClient } from "npm:@supabase/supabase-js@2"
import webpush from "npm:web-push@3.6.7"

const tutors = ["Tomek", "Wojtek", "Szymon", "Test"]

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const push = webpush.default ?? webpush

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    })
  }

  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY")
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY")
  if (!publicKey || !privateKey) {
    return new Response(JSON.stringify({ error: "missing vapid" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    })
  }

  const payload = await req.json().catch(() => null)
  const tutor = payload?.tutor
  if (!tutors.includes(tutor)) {
    return new Response(JSON.stringify({ error: "tutor" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    })
  }

  const title = String(payload.title || "Nowa rezerwacja").slice(0, 80)
  const body = String(payload.body || "Ktoś zarezerwował lekcję.").slice(0, 180)
  push.setVapidDetails("mailto:grafik@mateneza.app", publicKey, privateKey)

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  )
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("tutor", tutor)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    })
  }

  let sent = 0
  for (const row of data ?? []) {
    try {
      await push.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        },
        JSON.stringify({ title, body, tag: `rezerwacja-${row.id}-${Date.now()}` }),
      )
      sent += 1
    } catch (sendError) {
      const status = sendError?.statusCode
      if (status === 404 || status === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", row.id)
      }
    }
  }

  return new Response(JSON.stringify({ sent }), {
    headers: { ...cors, "Content-Type": "application/json" },
  })
})

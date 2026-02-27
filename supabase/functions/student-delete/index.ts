import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import { withCors } from "../_shared/cors.ts";
import { adminClient, authedClient } from "../_shared/supabase.ts";
import { getCallerProfileOrFail } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return withCors(null, { status: 204 }, req);
  if (req.method !== "POST") return withCors("Method not allowed", { status: 405 }, req);

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return withCors(JSON.stringify({ error: "invalid_json" }), { status: 400 }, req);
  }

  const { user_id } = payload || {};
  if (!user_id) {
    return withCors(JSON.stringify({ error: "missing_user_id" }), { status: 400 }, req);
  }

  const userClient = authedClient(req);
  const caller = await getCallerProfileOrFail(req, userClient);
  if (!caller.ok) return caller.res;

  const admin = adminClient();

  const { error } = await admin
    .from("students")
    .delete()
    .eq("tenant_id", caller.tenantId)
    .eq("user_id", String(user_id));

  if (error) {
    return withCors(JSON.stringify({ error: error.message }), { status: 400 }, req);
  }

  return withCors(JSON.stringify({ ok: true }), { status: 200 }, req);
});
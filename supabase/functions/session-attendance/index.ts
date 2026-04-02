// supabase/functions/session-attendance/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { withCors } from "../_shared/cors.ts";
import { adminClient, authedClient } from "../_shared/supabase.ts";
import { getCallerProfileOrFail } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return withCors(null, { status: 204 }, req);
  if (req.method !== "POST")
    return withCors(JSON.stringify({ ok: false, error: { code: "METHOD_NOT_ALLOWED" } }), { status: 405 }, req);

  let payload: any;
  try { payload = await req.json(); }
  catch { return withCors(JSON.stringify({ ok: false, error: { code: "INVALID_JSON" } }), { status: 400 }, req); }

  const { session_id, status } = payload ?? {};

  if (!session_id || !status)
    return withCors(JSON.stringify({ ok: false, error: { code: "MISSING_FIELDS", message: "session_id και status είναι υποχρεωτικά." } }), { status: 400 }, req);

  if (!["present", "absent"].includes(status))
    return withCors(JSON.stringify({ ok: false, error: { code: "INVALID_STATUS", message: "status πρέπει να είναι present ή absent." } }), { status: 400 }, req);

  const userClient = authedClient(req);
  const caller = await getCallerProfileOrFail(req, userClient);
  if (!caller.ok) return caller.res;

  const admin = adminClient();

  // Verify session belongs to tenant
  const { data: session } = await admin
    .from("class_sessions")
    .select("id, tenant_id")
    .eq("id", String(session_id))
    .eq("tenant_id", caller.tenantId)
    .maybeSingle();

  if (!session)
    return withCors(JSON.stringify({ ok: false, error: { code: "NOT_FOUND" } }), { status: 404 }, req);

  const { error } = await admin
    .from("class_session_students")
    .update({
      status: String(status),
      marked_at: new Date().toISOString(),
      marked_by: caller.userId,
    })
    .eq("session_id", String(session_id));

  if (error)
    return withCors(JSON.stringify({ ok: false, error: { code: "DB_UPDATE_FAILED", message: error.message } }), { status: 400 }, req);

  return withCors(JSON.stringify({ ok: true, data: { session_id, status } }), { status: 200 }, req);
});

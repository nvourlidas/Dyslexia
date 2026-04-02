// supabase/functions/session-delete/index.ts
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

  const { id } = payload ?? {};

  if (!id)
    return withCors(JSON.stringify({ ok: false, error: { code: "MISSING_FIELDS", message: "id είναι υποχρεωτικό." } }), { status: 400 }, req);

  const userClient = authedClient(req);
  const caller = await getCallerProfileOrFail(req, userClient);
  if (!caller.ok) return caller.res;

  const admin = adminClient();

  // Verify ownership
  const { data: row } = await admin
    .from("class_sessions")
    .select("id, tenant_id")
    .eq("id", String(id))
    .eq("tenant_id", caller.tenantId)
    .maybeSingle();

  if (!row)
    return withCors(JSON.stringify({ ok: false, error: { code: "NOT_FOUND" } }), { status: 404 }, req);

  // Delete attendance records first (FK)
  await admin.from("class_session_students").delete().eq("session_id", String(id));

  const { error } = await admin
    .from("class_sessions")
    .delete()
    .eq("id", String(id))
    .eq("tenant_id", caller.tenantId);

  if (error)
    return withCors(JSON.stringify({ ok: false, error: { code: "DB_DELETE_FAILED", message: error.message } }), { status: 400 }, req);

  return withCors(JSON.stringify({ ok: true, data: { id } }), { status: 200 }, req);
});

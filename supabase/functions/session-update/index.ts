// supabase/functions/session-update/index.ts
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

  const { id, student_id, starts_at, ends_at, status, notes } = payload ?? {};

  if (!id)
    return withCors(JSON.stringify({ ok: false, error: { code: "MISSING_FIELDS", message: "id είναι υποχρεωτικό." } }), { status: 400 }, req);

  const userClient = authedClient(req);
  const caller = await getCallerProfileOrFail(req, userClient);
  if (!caller.ok) return caller.res;

  const admin = adminClient();

  // Update session fields if provided
  const sessionUpdate: Record<string, any> = { updated_at: new Date().toISOString() };
  if (starts_at) sessionUpdate.starts_at = String(starts_at);
  if (ends_at) sessionUpdate.ends_at = String(ends_at);
  if (status) sessionUpdate.status = String(status);
  if (notes !== undefined) sessionUpdate.notes = notes ? String(notes).trim() : null;

  const { error: sessionErr } = await admin
    .from("class_sessions")
    .update(sessionUpdate)
    .eq("id", String(id))
    .eq("tenant_id", caller.tenantId);

  if (sessionErr)
    return withCors(JSON.stringify({ ok: false, error: { code: "DB_UPDATE_FAILED", message: sessionErr.message } }), { status: 400 }, req);

  // Handle student update: upsert or delete class_session_students
  if (student_id !== undefined) {
    // Remove existing student record
    await admin.from("class_session_students").delete().eq("session_id", String(id));

    if (student_id) {
      const { error: attErr } = await admin.from("class_session_students").insert({
        tenant_id: caller.tenantId,
        session_id: String(id),
        student_id: String(student_id),
        status: "present",
        marked_at: new Date().toISOString(),
      });
      if (attErr)
        return withCors(JSON.stringify({ ok: false, error: { code: "ATT_UPDATE_FAILED", message: attErr.message } }), { status: 400 }, req);
    }
  }

  return withCors(JSON.stringify({ ok: true, data: { id } }), { status: 200 }, req);
});

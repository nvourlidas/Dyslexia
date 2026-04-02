// supabase/functions/session-create/index.ts
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

  const { teacher_id, starts_at, ends_at, student_id, class_id, notes } = payload ?? {};

  if (!teacher_id || !starts_at || !ends_at)
    return withCors(JSON.stringify({ ok: false, error: { code: "MISSING_FIELDS", message: "teacher_id, starts_at, ends_at είναι υποχρεωτικά." } }), { status: 400 }, req);

  const userClient = authedClient(req);
  const caller = await getCallerProfileOrFail(req, userClient);
  if (!caller.ok) return caller.res;

  const admin = adminClient();
  const sessionId = crypto.randomUUID();

  const { error: sessionErr } = await admin.from("class_sessions").insert({
    id: sessionId,
    tenant_id: caller.tenantId,
    class_id: class_id ?? null,
    teacher_id: String(teacher_id),
    starts_at: String(starts_at),
    ends_at: String(ends_at),
    status: "scheduled",
    notes: notes ? String(notes).trim() : null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (sessionErr)
    return withCors(JSON.stringify({ ok: false, error: { code: "DB_INSERT_FAILED", message: sessionErr.message } }), { status: 400 }, req);

  // If a student is provided, create the attendance record
  if (student_id) {
    const { error: attErr } = await admin.from("class_session_students").insert({
      tenant_id: caller.tenantId,
      session_id: sessionId,
      student_id: String(student_id),
      status: "absent", // default — teacher marks present later
      marked_at: new Date().toISOString(),
    });
    if (attErr)
      return withCors(JSON.stringify({ ok: false, error: { code: "ATT_INSERT_FAILED", message: attErr.message } }), { status: 400 }, req);
  }

  return withCors(JSON.stringify({ ok: true, data: { id: sessionId } }), { status: 200 }, req);
});

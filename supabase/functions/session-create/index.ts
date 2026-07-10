// supabase/functions/session-create/index.ts
import { adminClient } from "../_shared/supabase.ts";
import { postHandler, ok, fail } from "../_shared/handler.ts";
import { assertOwnedIds, TenancyError } from "../_shared/tenancy.ts";

postHandler(async (payload, tenantId, _profile, req) => {
  const { teacher_id, starts_at, ends_at, student_id, class_id, notes } = payload ?? {};

  if (!teacher_id || !starts_at || !ends_at) {
    return fail("MISSING_FIELDS", "teacher_id, starts_at, ends_at είναι υποχρεωτικά.", req);
  }

  const admin = adminClient();

  try {
    await assertOwnedIds(admin, "teacher", [teacher_id], tenantId);
    await assertOwnedIds(admin, "classes", [class_id], tenantId);
    await assertOwnedIds(admin, "students", [student_id], tenantId, "user_id");
  } catch (err) {
    if (err instanceof TenancyError) {
      return fail(err.code, err.message, req, err.status);
    }
    throw err;
  }

  const sessionId = crypto.randomUUID();

  const { error: sessionErr } = await admin.from("class_sessions").insert({
    id: sessionId,
    tenant_id: tenantId,
    class_id: class_id ?? null,
    teacher_id: String(teacher_id),
    starts_at: String(starts_at),
    ends_at: String(ends_at),
    status: "scheduled",
    notes: notes ? String(notes).trim() : null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (sessionErr) return fail("DB_INSERT_FAILED", sessionErr.message, req);

  // If a student is provided, create the attendance record
  if (student_id) {
    const { error: attErr } = await admin.from("class_session_students").insert({
      tenant_id: tenantId,
      session_id: sessionId,
      student_id: String(student_id),
      status: "present",
      marked_at: new Date().toISOString(),
    });
    if (attErr) return fail("ATT_INSERT_FAILED", attErr.message, req);
  }

  return ok({ id: sessionId }, req);
});

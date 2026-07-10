// supabase/functions/session-update/index.ts
import { adminClient } from "../_shared/supabase.ts";
import { postHandler, ok, fail } from "../_shared/handler.ts";
import { assertOwnedIds, TenancyError } from "../_shared/tenancy.ts";

postHandler(async (payload, tenantId, _profile, req) => {
  const { id, student_id, starts_at, ends_at, status, notes } = payload ?? {};

  if (!id) return fail("MISSING_FIELDS", "id είναι υποχρεωτικό.", req);

  const admin = adminClient();

  // Ο client-supplied student_id πρέπει να ανήκει στο tenant του caller —
  // ίδιο guard με το session-create.
  if (student_id) {
    try {
      await assertOwnedIds(admin, "students", [student_id], tenantId, "user_id");
    } catch (err) {
      if (err instanceof TenancyError) {
        return fail(err.code, err.message, req, err.status);
      }
      throw err;
    }
  }

  // Update session fields if provided
  const sessionUpdate: Record<string, any> = { updated_at: new Date().toISOString() };
  if (starts_at) sessionUpdate.starts_at = String(starts_at);
  if (ends_at) sessionUpdate.ends_at = String(ends_at);
  if (status) sessionUpdate.status = String(status);
  if (notes !== undefined) sessionUpdate.notes = notes ? String(notes).trim() : null;

  const { data: updatedRows, error: sessionErr } = await admin
    .from("class_sessions")
    .update(sessionUpdate)
    .eq("id", String(id))
    .eq("tenant_id", tenantId)
    .select();

  if (sessionErr) return fail("DB_UPDATE_FAILED", sessionErr.message, req);

  if (!updatedRows || updatedRows.length === 0) {
    return fail("NOT_FOUND", "Η συνεδρία δεν βρέθηκε.", req, 404);
  }

  // Handle student update: replace or remove the class_session_students record
  if (student_id !== undefined) {
    await admin
      .from("class_session_students")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("session_id", String(id));

    if (student_id) {
      const { error: attErr } = await admin.from("class_session_students").insert({
        tenant_id: tenantId,
        session_id: String(id),
        student_id: String(student_id),
        status: "present",
        marked_at: new Date().toISOString(),
      });
      if (attErr) return fail("ATT_UPDATE_FAILED", attErr.message, req);
    }
  }

  return ok({ id }, req);
});

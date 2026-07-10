// supabase/functions/session-delete/index.ts
import { adminClient } from "../_shared/supabase.ts";
import { postHandler, ok, fail } from "../_shared/handler.ts";

postHandler(async (payload, tenantId, _profile, req) => {
  const { id } = payload ?? {};

  if (!id) return fail("MISSING_FIELDS", "id είναι υποχρεωτικό.", req);

  const admin = adminClient();

  // Verify ownership
  const { data: row, error: checkErr } = await admin
    .from("class_sessions")
    .select("id, tenant_id")
    .eq("id", String(id))
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (checkErr) return fail("DB_CHECK_FAILED", checkErr.message, req);

  if (!row) return fail("NOT_FOUND", "Η συνεδρία δεν βρέθηκε.", req, 404);

  // Delete attendance records first (FK)
  const { error: attErr } = await admin
    .from("class_session_students")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("session_id", String(id));

  if (attErr) return fail("DB_DELETE_FAILED", attErr.message, req);

  const { error } = await admin
    .from("class_sessions")
    .delete()
    .eq("id", String(id))
    .eq("tenant_id", tenantId);

  if (error) return fail("DB_DELETE_FAILED", error.message, req);

  return ok({ id }, req);
});

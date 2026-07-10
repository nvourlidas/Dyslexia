// supabase/functions/session-attendance/index.ts
import { adminClient } from "../_shared/supabase.ts";
import { postHandler, ok, fail } from "../_shared/handler.ts";

postHandler(async (payload, tenantId, profile, req) => {
  const { session_id, status } = payload ?? {};

  if (!session_id || !status) {
    return fail("MISSING_FIELDS", "session_id και status είναι υποχρεωτικά.", req);
  }

  if (!["present", "absent"].includes(status)) {
    return fail("INVALID_STATUS", "status πρέπει να είναι present ή absent.", req);
  }

  const admin = adminClient();

  // Verify session belongs to tenant
  const { data: session, error: checkErr } = await admin
    .from("class_sessions")
    .select("id, tenant_id")
    .eq("id", String(session_id))
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (checkErr) return fail("DB_CHECK_FAILED", checkErr.message, req);

  if (!session) return fail("NOT_FOUND", "Η συνεδρία δεν βρέθηκε.", req, 404);

  const { error } = await admin
    .from("class_session_students")
    .update({
      status: String(status),
      marked_at: new Date().toISOString(),
      marked_by: profile.id,
    })
    .eq("tenant_id", tenantId)
    .eq("session_id", String(session_id));

  if (error) return fail("DB_UPDATE_FAILED", error.message, req);

  return ok({ session_id, status }, req);
});

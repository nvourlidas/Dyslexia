// supabase/functions/student-bulk-delete/index.ts
import { adminClient } from "../_shared/supabase.ts";
import { postHandler, ok, fail } from "../_shared/handler.ts";

postHandler(async (payload, tenantId, _profile, req) => {
  const { ids } = payload ?? {};

  if (!Array.isArray(ids) || ids.length === 0) {
    return fail("MISSING_FIELDS", "Το πεδίο ids είναι υποχρεωτικό και δεν μπορεί να είναι κενό.", req);
  }

  const admin = adminClient();

  // 0. Επαλήθευσε ότι όλα τα ids ανήκουν στο tenant του caller
  const { data: ownedStudents, error: ownErr } = await admin
    .from("students")
    .select("user_id")
    .in("user_id", ids)
    .eq("tenant_id", tenantId);

  if (ownErr) return fail("DB_CHECK_FAILED", ownErr.message, req);

  if (!ownedStudents || ownedStudents.length !== ids.length) {
    return fail("NOT_FOUND", "Ένας ή περισσότεροι μαθητές δεν βρέθηκαν στο tenant σου.", req, 404);
  }

  // 1. Διέγραψε παραπεμπτικά των μαθητών
  const { error: parapErr } = await admin
    .from("parapemtiko")
    .delete()
    .eq("tenant_id", tenantId)
    .in("student_id", ids);

  if (parapErr) return fail("DB_DELETE_FAILED", parapErr.message, req);

  // 2. Διέγραψε τα doc_opinions
  const { error: docDelErr } = await admin
    .from("doc_opinion")
    .delete()
    .eq("tenant_id", tenantId)
    .in("student_id", ids);

  if (docDelErr) return fail("DB_DELETE_FAILED", docDelErr.message, req);

  // 3. Διέγραψε τον μαθητή από όλα τα class_sessions
  const { error: sessionStudentsErr } = await admin
    .from("class_session_students")
    .delete()
    .eq("tenant_id", tenantId)
    .in("student_id", ids);

  if (sessionStudentsErr) return fail("DB_DELETE_FAILED", sessionStudentsErr.message, req);

  // 4. Διέγραψε τους μαθητές
  const { error } = await admin
    .from("students")
    .delete()
    .eq("tenant_id", tenantId)
    .in("user_id", ids);

  if (error) {
    if (error.code === "23503") {
      return fail(
        "CONFLICT",
        "Ένας ή περισσότεροι μαθητές έχουν συνδεδεμένες εγγραφές και δεν μπορούν να διαγραφούν.",
        req,
        409,
      );
    }
    return fail("DB_DELETE_FAILED", error.message, req);
  }

  return ok({ deleted: ids.length }, req);
});

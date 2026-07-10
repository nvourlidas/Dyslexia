// supabase/functions/teacher-delete/index.ts
import { adminClient } from "../_shared/supabase.ts";
import { postHandler, ok, fail } from "../_shared/handler.ts";

postHandler(async (payload, tenantId, _profile, req) => {
  const { id } = payload ?? {};

  if (!id) return fail("MISSING_FIELDS", "Το id είναι υποχρεωτικό.", req);

  const admin = adminClient();

  // verify the teacher belongs to the caller's tenant before deleting
  const { data: teacherRow, error: checkErr } = await admin
    .from("teacher")
    .select("id, tenant_id")
    .eq("tenant_id", tenantId)
    .eq("id", String(id))
    .maybeSingle();

  if (checkErr) return fail("DB_CHECK_FAILED", checkErr.message, req);

  if (!teacherRow) {
    return fail("NOT_FOUND", "Ο εκπαιδευτικός δεν βρέθηκε στο tenant σου.", req, 404);
  }

  const { error } = await admin
    .from("teacher")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", String(id));

  if (error) {
    if (error.code === "23503") {
      return fail(
        "CONFLICT",
        "Ο εκπαιδευτικός έχει συνδεδεμένες συνεδρίες και δεν μπορεί να διαγραφεί.",
        req,
        409,
      );
    }
    return fail("DB_DELETE_FAILED", error.message, req);
  }

  return ok({ id }, req);
});

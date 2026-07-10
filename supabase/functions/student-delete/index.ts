// supabase/functions/student-delete/index.ts
import { adminClient } from "../_shared/supabase.ts";
import { postHandler, ok, fail } from "../_shared/handler.ts";

postHandler(async (payload, tenantId, _profile, req) => {
  const { user_id } = payload ?? {};
  if (!user_id) return fail("MISSING_FIELDS", "Το user_id είναι υποχρεωτικό.", req);

  const admin = adminClient();

  const { error } = await admin
    .from("students")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("user_id", String(user_id));

  if (error) {
    // 23503 = foreign_key_violation: the student still has linked records
    if (error.code === "23503") {
      return fail(
        "CONFLICT",
        "Ο μαθητής έχει συνδεδεμένες εγγραφές (γνωματεύσεις, παραπεμπτικά ή συνεδρίες) και δεν μπορεί να διαγραφεί.",
        req,
        409,
      );
    }
    return fail("DB_DELETE_FAILED", error.message, req);
  }

  return ok({ user_id }, req);
});

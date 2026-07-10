// supabase/functions/class-delete/index.ts
import { adminClient } from "../_shared/supabase.ts";
import { postHandler, ok, fail } from "../_shared/handler.ts";

postHandler(async (payload, tenantId, _profile, req) => {
  const { id } = payload ?? {};

  if (!id) return fail("MISSING_FIELDS", "id είναι υποχρεωτικό.", req);

  const admin = adminClient();

  // Verify ownership
  const { data: row, error: checkErr } = await admin
    .from("classes")
    .select("id")
    .eq("id", String(id))
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (checkErr) return fail("DB_CHECK_FAILED", checkErr.message, req);

  if (!row) return fail("NOT_FOUND", "Το τμήμα δεν βρέθηκε.", req, 404);

  const { error } = await admin
    .from("classes")
    .delete()
    .eq("id", String(id))
    .eq("tenant_id", tenantId);

  if (error) {
    if (error.code === "23503") {
      return fail(
        "CONFLICT",
        "Το τμήμα έχει συνδεδεμένες συνεδρίες και δεν μπορεί να διαγραφεί.",
        req,
        409,
      );
    }
    return fail("DB_DELETE_FAILED", error.message, req);
  }

  return ok({ id }, req);
});

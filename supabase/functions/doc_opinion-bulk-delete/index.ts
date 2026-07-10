// supabase/functions/doc_opinion-bulk-delete/index.ts
import { adminClient } from "../_shared/supabase.ts";
import { postHandler, ok, fail } from "../_shared/handler.ts";
import { assertOwnedIds, TenancyError } from "../_shared/tenancy.ts";

postHandler(async (payload, tenantId, _profile, req) => {
  const { ids } = payload ?? {};

  if (!Array.isArray(ids) || ids.length === 0) {
    return fail("MISSING_FIELDS", "Το πεδίο ids είναι υποχρεωτικό και δεν μπορεί να είναι κενό.", req);
  }

  const admin = adminClient();

  try {
    await assertOwnedIds(admin, "doc_opinion", ids, tenantId);
  } catch (err) {
    if (err instanceof TenancyError) {
      return fail(err.code, err.message, req, err.status);
    }
    throw err;
  }

  const { error } = await admin
    .from("doc_opinion")
    .delete()
    .eq("tenant_id", tenantId)
    .in("id", ids);

  if (error) {
    if (error.code === "23503") {
      return fail(
        "CONFLICT",
        "Μία ή περισσότερες γνωματεύσεις έχουν συνδεδεμένα παραπεμπτικά και δεν μπορούν να διαγραφούν.",
        req,
        409,
      );
    }
    return fail("DB_DELETE_FAILED", error.message, req);
  }

  return ok({ deleted: ids.length }, req);
});

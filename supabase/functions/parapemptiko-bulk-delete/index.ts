// supabase/functions/parapemptiko-bulk-delete/index.ts
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
    await assertOwnedIds(admin, "parapemtiko", ids, tenantId);
  } catch (err) {
    if (err instanceof TenancyError) {
      return fail(err.code, err.message, req, err.status);
    }
    throw err;
  }

  const { error } = await admin
    .from("parapemtiko")
    .delete()
    .eq("tenant_id", tenantId)
    .in("id", ids);

  if (error) return fail("DB_DELETE_FAILED", error.message, req);

  return ok({ deleted: ids.length }, req);
});

// supabase/functions/parapemptiko-delete/index.ts
import { adminClient } from "../_shared/supabase.ts";
import { postHandler, ok, fail } from "../_shared/handler.ts";

postHandler(async (payload, tenantId, _, req) => {
  const { id } = payload;
  if (!id) return fail("MISSING_ID", "Το id είναι υποχρεωτικό.", req);

  const admin = adminClient();
  const { error } = await admin
    .from("parapemtiko")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", String(id));

  if (error) return fail("DB_DELETE_FAILED", error.message, req);

  return ok({}, req);
});

// supabase/functions/class-update/index.ts
import { adminClient } from "../_shared/supabase.ts";
import { postHandler, ok, fail } from "../_shared/handler.ts";

postHandler(async (payload, tenantId, _profile, req) => {
  const { id, title, description, active } = payload ?? {};

  if (!id || !title || !String(title).trim()) {
    return fail("MISSING_FIELDS", "id και title είναι υποχρεωτικά.", req);
  }

  const admin = adminClient();

  // Full update: description/active που δεν στέλνονται επανέρχονται στα
  // defaults — η φόρμα του frontend στέλνει πάντα όλα τα πεδία.
  const { data: updatedRows, error } = await admin
    .from("classes")
    .update({
      title: String(title).trim(),
      description: description ? String(description).trim() : null,
      active: active ?? true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", String(id))
    .eq("tenant_id", tenantId)
    .select();

  if (error) return fail("DB_UPDATE_FAILED", error.message, req);

  if (!updatedRows || updatedRows.length === 0) {
    return fail("NOT_FOUND", "Το τμήμα δεν βρέθηκε.", req, 404);
  }

  return ok({ id }, req);
});

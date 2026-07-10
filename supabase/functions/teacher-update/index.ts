// supabase/functions/teacher-update/index.ts
import { adminClient } from "../_shared/supabase.ts";
import { postHandler, ok, fail } from "../_shared/handler.ts";

postHandler(async (payload, tenantId, _profile, req) => {
  const { id, name, last_name, phone, email, idikotita, active } = payload ?? {};

  if (!id || !name || !last_name) {
    return fail("MISSING_FIELDS", "Το id, όνομα και επώνυμο είναι υποχρεωτικά.", req);
  }

  const admin = adminClient();

  // Full update: τα προαιρετικά πεδία που δεν στέλνονται μηδενίζονται —
  // η φόρμα του frontend στέλνει πάντα όλα τα πεδία.
  const updatePayload = {
    name: String(name).trim(),
    last_name: String(last_name).trim(),
    phone: phone ? String(phone).trim() : null,
    email: email ? String(email).trim() : null,
    idikotita: idikotita ? String(idikotita).trim() : null,
    active: active ?? true,
    updated_at: new Date().toISOString(),
  };

  const { data: updatedRows, error } = await admin
    .from("teacher")
    .update(updatePayload)
    .eq("tenant_id", tenantId)
    .eq("id", String(id))
    .select();

  if (error) return fail("DB_UPDATE_FAILED", error.message, req);

  if (!updatedRows || updatedRows.length === 0) {
    return fail("NOT_FOUND", "Ο εκπαιδευτικός δεν βρέθηκε.", req, 404);
  }

  return ok({ id }, req);
});

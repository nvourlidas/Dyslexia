// supabase/functions/teacher-create/index.ts
import { adminClient } from "../_shared/supabase.ts";
import { postHandler, ok, fail } from "../_shared/handler.ts";

postHandler(async (payload, tenantId, _profile, req) => {
  const { name, last_name, phone, email, idikotita, active } = payload ?? {};

  if (!name || !last_name) {
    return fail("MISSING_FIELDS", "Το όνομα και το επώνυμο είναι υποχρεωτικά.", req);
  }

  const admin = adminClient();
  const newId = crypto.randomUUID();

  const insertPayload = {
    id: newId,
    tenant_id: tenantId,
    name: String(name).trim(),
    last_name: String(last_name).trim(),
    phone: phone ? String(phone).trim() : null,
    email: email ? String(email).trim() : null,
    idikotita: idikotita ? String(idikotita).trim() : null,
    active: active ?? true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await admin.from("teacher").insert(insertPayload);

  if (error) return fail("DB_INSERT_FAILED", error.message, req);

  return ok({ id: newId }, req);
});

// supabase/functions/student-create/index.ts
import { adminClient } from "../_shared/supabase.ts";
import { postHandler, ok, fail } from "../_shared/handler.ts";

postHandler(async (payload, tenantId, _profile, req) => {
  const {
    name, lastname, phone, email, city, address, amka,
    gender, birthdate, parent_name, parent_phone1, parent_phone2,
    active, doctor_visit, doctor_name,
  } = payload ?? {};

  if (!name || !lastname) {
    return fail("MISSING_FIELDS", "Το όνομα και το επώνυμο είναι υποχρεωτικά.", req);
  }

  const admin = adminClient();
  const newId = crypto.randomUUID();

  const insertPayload = {
    user_id: newId,
    tenant_id: tenantId,
    name: String(name).trim(),
    lastname: String(lastname).trim(),
    phone: phone ? String(phone).trim() : null,
    email: email ? String(email).trim() : null,
    city: city ? String(city).trim() : null,
    address: address ? String(address).trim() : null,
    amka: amka ? String(amka).trim() : null,
    gender: gender ?? "unknown",
    birthdate: birthdate || null,
    parent_name: parent_name ? String(parent_name).trim() : null,
    parent_phone1: parent_phone1 ? String(parent_phone1).trim() : null,
    parent_phone2: parent_phone2 ? String(parent_phone2).trim() : null,
    active: active ?? true,
    doctor_visit: doctor_visit ?? false,
    doctor_name: doctor_name ? String(doctor_name).trim() : null,
    created_at: new Date().toISOString(),
    updated_at: null,
  };

  const { error } = await admin.from("students").insert(insertPayload);

  if (error) return fail("DB_INSERT_FAILED", error.message, req);

  return ok({ id: newId }, req);
});

// supabase/functions/student-update/index.ts
import { adminClient } from "../_shared/supabase.ts";
import { postHandler, ok, fail } from "../_shared/handler.ts";

postHandler(async (payload, tenantId, _profile, req) => {
  const {
    user_id, name, lastname, phone, email, city, address, amka,
    gender, birthdate, parent_name, parent_phone1, parent_phone2,
    active, doctor_visit, doctor_name,
  } = payload ?? {};

  if (!user_id) {
    return fail("MISSING_FIELDS", "Το user_id είναι υποχρεωτικό.", req);
  }

  const admin = adminClient();

  // Whitelist των πεδίων που επιτρέπεται να ενημερωθούν (καμία σχέση με
  // tenant_id/user_id/created_at) — ενημερώνεται μόνο ό,τι στέλνεται.
  const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
  if (name !== undefined) updatePayload.name = String(name).trim();
  if (lastname !== undefined) updatePayload.lastname = String(lastname).trim();
  if (phone !== undefined) updatePayload.phone = phone ? String(phone).trim() : null;
  if (email !== undefined) updatePayload.email = email ? String(email).trim() : null;
  if (city !== undefined) updatePayload.city = city ? String(city).trim() : null;
  if (address !== undefined) updatePayload.address = address ? String(address).trim() : null;
  if (amka !== undefined) updatePayload.amka = amka ? String(amka).trim() : null;
  if (gender !== undefined) updatePayload.gender = gender ?? "unknown";
  if (birthdate !== undefined) updatePayload.birthdate = birthdate || null;
  if (parent_name !== undefined) updatePayload.parent_name = parent_name ? String(parent_name).trim() : null;
  if (parent_phone1 !== undefined) updatePayload.parent_phone1 = parent_phone1 ? String(parent_phone1).trim() : null;
  if (parent_phone2 !== undefined) updatePayload.parent_phone2 = parent_phone2 ? String(parent_phone2).trim() : null;
  if (active !== undefined) updatePayload.active = active;
  if (doctor_visit !== undefined) updatePayload.doctor_visit = doctor_visit;
  if (doctor_name !== undefined) updatePayload.doctor_name = doctor_name ? String(doctor_name).trim() : null;

  const { data: updatedRows, error } = await admin
    .from("students")
    .update(updatePayload)
    .eq("tenant_id", tenantId)
    .eq("user_id", String(user_id))
    .select();

  if (error) return fail("DB_UPDATE_FAILED", error.message, req);

  if (!updatedRows || updatedRows.length === 0) {
    return fail("NOT_FOUND", "Ο μαθητής δεν βρέθηκε.", req, 404);
  }

  return ok({ user_id }, req);
});

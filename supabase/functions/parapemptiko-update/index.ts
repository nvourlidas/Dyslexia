// supabase/functions/parapemptiko-update/index.ts
import { adminClient } from "../_shared/supabase.ts";
import { postHandler, ok, fail } from "../_shared/handler.ts";

postHandler(async (payload, tenantId, _, req) => {
  const { id, title, student_id, code, code_diagnosis, start_date, end_date, status, notes } = payload;

  if (!id) return fail("MISSING_ID", "Το id είναι υποχρεωτικό.", req);

  const admin = adminClient();

  const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
  if (title !== undefined) updateData.title = String(title).trim();
  if (student_id !== undefined) updateData.student_id = student_id || null;
  if (code !== undefined) updateData.code = code ? String(code).trim() : null;
  if (code_diagnosis !== undefined) updateData.code_diagnosis = code_diagnosis ? String(code_diagnosis).trim() : null;
  if (start_date !== undefined) updateData.start_date = start_date;
  if (end_date !== undefined) updateData.end_date = end_date || null;
  if (status !== undefined) {
    const allowed = ["pending", "completed", "inactive"];
    updateData.status = allowed.includes(status) ? status : "pending";
  }
  if (notes !== undefined) updateData.notes = notes ? String(notes).trim() : null;

  const { error } = await admin
    .from("parapemtiko")
    .update(updateData)
    .eq("tenant_id", tenantId)
    .eq("id", String(id));

  if (error) return fail("DB_UPDATE_FAILED", error.message, req);

  return ok({}, req);
});

// supabase/functions/doc_opinion-update/index.ts
import { adminClient } from "../_shared/supabase.ts";
import { postHandler, ok, fail } from "../_shared/handler.ts";
import { assertOwnedIds, TenancyError } from "../_shared/tenancy.ts";

postHandler(async (payload, tenantId, _profile, req) => {
  const { id, student_id, start_date, end_date, notes, status, parapemptiko_ids } = payload ?? {};

  if (!id) return fail("MISSING_ID", "Το id είναι υποχρεωτικό.", req);

  const admin = adminClient();

  if (student_id) {
    try {
      await assertOwnedIds(admin, "students", [student_id], tenantId, "user_id");
    } catch (err) {
      if (err instanceof TenancyError) {
        return fail(err.code, err.message, req, err.status);
      }
      throw err;
    }
  }

  const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
  if (student_id !== undefined) updatePayload.student_id = student_id;
  if (start_date !== undefined) updatePayload.start_date = start_date;
  if (end_date !== undefined) updatePayload.end_date = end_date || null;
  if (notes !== undefined) updatePayload.notes = notes ? String(notes).trim() : null;
  if (status !== undefined) updatePayload.status = status === "completed" ? "completed" : "pending";

  const { data: updatedRows, error: updateErr } = await admin
    .from("doc_opinion")
    .update(updatePayload)
    .eq("tenant_id", tenantId)
    .eq("id", String(id))
    .select();

  if (updateErr) return fail("DB_UPDATE_FAILED", updateErr.message, req);

  if (!updatedRows || updatedRows.length === 0) {
    return fail("NOT_FOUND", "Η γνωμάτευση δεν βρέθηκε.", req, 404);
  }

  // Sync parapemptika links:
  // 1. Unlink all currently linked to this doc_opinion
  // 2. Link the new selected ones
  if (Array.isArray(parapemptiko_ids)) {
    const { error: unlinkErr } = await admin
      .from("parapemtiko")
      .update({ doc_opinion_id: null })
      .eq("tenant_id", tenantId)
      .eq("doc_opinion_id", String(id));

    if (unlinkErr) return fail("UNLINK_FAILED", unlinkErr.message, req);

    const ids = parapemptiko_ids.filter(Boolean);
    if (ids.length > 0) {
      const { error: linkErr } = await admin
        .from("parapemtiko")
        .update({ doc_opinion_id: String(id) })
        .eq("tenant_id", tenantId)
        .in("id", ids);

      if (linkErr) return fail("LINK_FAILED", linkErr.message, req);
    }
  }

  return ok({ id }, req);
});

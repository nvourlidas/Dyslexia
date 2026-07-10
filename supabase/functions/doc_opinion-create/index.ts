// supabase/functions/doc_opinion-create/index.ts
import { adminClient } from "../_shared/supabase.ts";
import { postHandler, ok, fail } from "../_shared/handler.ts";

postHandler(async (payload, tenantId, _profile, req) => {
  const { student_id, start_date, end_date, notes, status, parapemptiko_ids } = payload ?? {};

  if (!student_id || !start_date) {
    return fail("MISSING_FIELDS", "Το student_id και το start_date είναι υποχρεωτικά.", req);
  }

  const admin = adminClient();

  const { data: studentRow, error: studentErr } = await admin
    .from("students")
    .select("user_id, tenant_id")
    .eq("tenant_id", tenantId)
    .eq("user_id", String(student_id))
    .maybeSingle();

  if (studentErr) return fail("STUDENT_CHECK_FAILED", studentErr.message, req);

  if (!studentRow) {
    return fail("STUDENT_NOT_FOUND", "Ο επιλεγμένος μαθητής δεν βρέθηκε στο tenant σου.", req, 404);
  }

  const newId = crypto.randomUUID();

  const insertPayload = {
    id: newId,
    tenant_id: tenantId,
    student_id: String(student_id),
    start_date: String(start_date),
    end_date: end_date ? String(end_date) : null,
    notes: notes ? String(notes).trim() : null,
    status: status === "completed" ? "completed" : "pending",
    created_at: new Date().toISOString(),
  };

  const { error } = await admin.from("doc_opinion").insert(insertPayload);

  if (error) return fail("DB_INSERT_FAILED", error.message, req);

  // Link parapemptika to this doc_opinion
  const ids = Array.isArray(parapemptiko_ids) ? parapemptiko_ids.filter(Boolean) : [];
  if (ids.length > 0) {
    const { error: linkErr } = await admin
      .from("parapemtiko")
      .update({ doc_opinion_id: newId })
      .eq("tenant_id", tenantId)
      .in("id", ids);

    if (linkErr) return fail("LINK_FAILED", linkErr.message, req);
  }

  return ok({ id: newId }, req);
});

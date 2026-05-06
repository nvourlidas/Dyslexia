// supabase/functions/parapemptiko-create/index.ts
import { adminClient } from "../_shared/supabase.ts";
import { postHandler, ok, fail } from "../_shared/handler.ts";

postHandler(async (payload, tenantId, _, req) => {
  const { title, student_id, code, code_diagnosis, start_date, end_date, status, notes } = payload;

  if (!title?.trim()) return fail("MISSING_TITLE", "Ο τίτλος είναι υποχρεωτικός.", req);
  if (!student_id) return fail("MISSING_STUDENT", "Πρέπει να επιλέξεις μαθητή.", req);
  if (!start_date) return fail("MISSING_START_DATE", "Η ημ/νία έναρξης είναι υποχρεωτική.", req);

  const admin = adminClient();

  const { data: student, error: sErr } = await admin
    .from("students")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("user_id", String(student_id))
    .maybeSingle();

  if (sErr) return fail("STUDENT_CHECK_FAILED", sErr.message, req);
  if (!student) return fail("STUDENT_NOT_FOUND", "Ο μαθητής δεν βρέθηκε.", req, 404);

  const id = crypto.randomUUID();

  const { error } = await admin.from("parapemtiko").insert({
    id,
    tenant_id: tenantId,
    title: String(title).trim(),
    student_id: String(student_id),
    code: code ? String(code).trim() : null,
    code_diagnosis: code_diagnosis ? String(code_diagnosis).trim() : null,
    start_date: String(start_date),
    end_date: end_date ? String(end_date) : null,
    status: status === "completed" ? "completed" : "pending",
    notes: notes ? String(notes).trim() : null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (error) return fail("DB_INSERT_FAILED", error.message, req);

  return ok({ id }, req);
});

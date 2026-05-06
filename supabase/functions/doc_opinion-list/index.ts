// supabase/functions/doc_opinion-list/index.ts
import { adminClient } from "../_shared/supabase.ts";
import { postHandler, ok, fail } from "../_shared/handler.ts";

const SELECT =
  "id,tenant_id,student_id,start_date,end_date,notes,status,created_at,updated_at,student:students(name,lastname,amka),parapemptika:parapemtiko(code,code_diagnosis)";

postHandler(async (payload, tenantId, _, req) => {
  const {
    page = 1,
    page_size = 15,
    query = "",
    status_filter = "all",
    student_id_filter = "",
    end_date_filter = "all",
  } = payload;

  const pageNum = Math.max(1, Number(page));
  const pageSize = Math.min(100, Math.max(1, Number(page_size)));
  const from = (pageNum - 1) * pageSize;
  const to = from + pageSize - 1;

  const admin = adminClient();

  let qb = admin
    .from("doc_opinion")
    .select(SELECT, { count: "exact" })
    .eq("tenant_id", tenantId);

  const qq = String(query).trim();
  if (qq) {
    const safe = qq.replace(/,/g, " ");

    const { data: matchingStudents } = await admin
      .from("students")
      .select("user_id")
      .eq("tenant_id", tenantId)
      .or(`name.ilike.%${safe}%,lastname.ilike.%${safe}%,amka.ilike.%${safe}%`);
    const studentIds = (matchingStudents ?? []).map((s: any) => s.user_id);

    const { data: matchingParapemptika } = await admin
      .from("parapemtiko")
      .select("doc_opinion_id")
      .eq("tenant_id", tenantId)
      .not("doc_opinion_id", "is", null)
      .or(`code.ilike.%${safe}%,code_diagnosis.ilike.%${safe}%`);
    const docOpinionIds = [
      ...new Set(
        (matchingParapemptika ?? []).map((p: any) => p.doc_opinion_id).filter(Boolean),
      ),
    ];

    let orParts = `notes.ilike.%${safe}%`;
    if (studentIds.length > 0) orParts += `,student_id.in.(${studentIds.join(",")})`;
    if (docOpinionIds.length > 0) orParts += `,id.in.(${docOpinionIds.join(",")})`;
    qb = qb.or(orParts);
  }

  if (status_filter !== "all") qb = qb.eq("status", String(status_filter));
  if (student_id_filter) qb = qb.eq("student_id", String(student_id_filter));

  const today = new Date().toISOString().slice(0, 10);
  if (end_date_filter === "expired") qb = qb.not("end_date", "is", null).lt("end_date", today);
  else if (end_date_filter === "active") qb = qb.or(`end_date.is.null,end_date.gte.${today}`);
  else if (end_date_filter === "none") qb = qb.is("end_date", null);

  const { data, error, count } = await qb
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) return fail("DB_SELECT_FAILED", error.message, req);

  const rows = (data ?? []).map((item: any) => ({
    ...item,
    student: Array.isArray(item.student) ? item.student[0] ?? null : item.student ?? null,
    parapemptika: Array.isArray(item.parapemptika) ? item.parapemptika : [],
  }));

  return ok({ rows, total: count ?? 0 }, req);
});

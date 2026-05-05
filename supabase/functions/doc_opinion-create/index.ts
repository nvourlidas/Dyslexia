import { withCors } from "../_shared/cors.ts";
import { adminClient, authedClient } from "../_shared/supabase.ts";
import { getCallerProfileOrFail } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  console.log("doc_opinion-create HIT", req.method, "origin:", req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return withCors(null, { status: 204 }, req);
  }

  if (req.method !== "POST") {
    return withCors(
      JSON.stringify({ ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" } }),
      { status: 405, headers: { "Content-Type": "application/json" } },
      req,
    );
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return withCors(
      JSON.stringify({ ok: false, error: { code: "INVALID_JSON", message: "Invalid JSON body" } }),
      { status: 400, headers: { "Content-Type": "application/json" } },
      req,
    );
  }

  const { student_id, start_date, end_date, notes, status, parapemptiko_ids } = payload ?? {};

  if (!student_id || !start_date) {
    return withCors(
      JSON.stringify({ ok: false, error: { code: "MISSING_FIELDS", message: "Το student_id και το start_date είναι υποχρεωτικά." } }),
      { status: 400, headers: { "Content-Type": "application/json" } },
      req,
    );
  }

  const userClient = authedClient(req);
  const caller = await getCallerProfileOrFail(req, userClient);
  if (!caller.ok) return caller.res;
  console.log("CALLER OK, tenantId:", caller.tenantId);

  const admin = adminClient();

  const { data: studentRow, error: studentErr } = await admin
    .from("students")
    .select("user_id, tenant_id")
    .eq("tenant_id", caller.tenantId)
    .eq("user_id", String(student_id))
    .maybeSingle();

  console.log("STUDENT CHECK:", JSON.stringify({ studentRow, studentErr }));

  if (studentErr) {
    return withCors(
      JSON.stringify({ ok: false, error: { code: "STUDENT_CHECK_FAILED", message: studentErr.message } }),
      { status: 400, headers: { "Content-Type": "application/json" } },
      req,
    );
  }

  if (!studentRow) {
    return withCors(
      JSON.stringify({ ok: false, error: { code: "STUDENT_NOT_FOUND", message: "Ο επιλεγμένος μαθητής δεν βρέθηκε στο tenant σου." } }),
      { status: 404, headers: { "Content-Type": "application/json" } },
      req,
    );
  }

  const newId = crypto.randomUUID();

  const insertPayload = {
    id: newId,
    tenant_id: caller.tenantId,
    student_id: String(student_id),
    start_date: String(start_date),
    end_date: end_date ? String(end_date) : null,
    notes: notes ? String(notes).trim() : null,
    status: status === "completed" ? "completed" : "pending",
    created_at: new Date().toISOString(),
  };

  console.log("INSERTING doc_opinion...", JSON.stringify(insertPayload));
  const { error } = await admin.from("doc_opinion").insert(insertPayload);
  console.log("INSERT DONE, error:", JSON.stringify(error));

  if (error) {
    return withCors(
      JSON.stringify({ ok: false, error: { code: "DB_INSERT_FAILED", message: error.message } }),
      { status: 400, headers: { "Content-Type": "application/json" } },
      req,
    );
  }

  // Link parapemptika to this doc_opinion
  const ids = Array.isArray(parapemptiko_ids) ? parapemptiko_ids.filter(Boolean) : [];
  if (ids.length > 0) {
    const { error: linkErr } = await admin
      .from("parapemtiko")
      .update({ doc_opinion_id: newId })
      .eq("tenant_id", caller.tenantId)
      .in("id", ids);

    if (linkErr) {
      return withCors(
        JSON.stringify({ ok: false, error: { code: "LINK_FAILED", message: linkErr.message } }),
        { status: 400, headers: { "Content-Type": "application/json" } },
        req,
      );
    }
  }

  return withCors(
    JSON.stringify({ ok: true, data: { id: newId } }),
    { status: 200, headers: { "Content-Type": "application/json" } },
    req,
  );
});
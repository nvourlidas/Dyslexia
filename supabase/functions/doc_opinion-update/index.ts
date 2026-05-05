import { withCors } from "../_shared/cors.ts";
import { adminClient, authedClient } from "../_shared/supabase.ts";
import { getCallerProfileOrFail } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return withCors(null, { status: 204 }, req);
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

  const { id, student_id, start_date, end_date, notes, status, parapemptiko_ids } = payload ?? {};

  if (!id) {
    return withCors(
      JSON.stringify({ ok: false, error: { code: "MISSING_ID", message: "Το id είναι υποχρεωτικό." } }),
      { status: 400, headers: { "Content-Type": "application/json" } },
      req,
    );
  }

  const userClient = authedClient(req);
  const caller = await getCallerProfileOrFail(req, userClient);
  if (!caller.ok) return caller.res;

  const admin = adminClient();

  const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
  if (student_id !== undefined) updatePayload.student_id = student_id;
  if (start_date !== undefined) updatePayload.start_date = start_date;
  if (end_date !== undefined) updatePayload.end_date = end_date || null;
  if (notes !== undefined) updatePayload.notes = notes ? String(notes).trim() : null;
  if (status !== undefined) updatePayload.status = status === "completed" ? "completed" : "pending";

  const { error: updateErr } = await admin
    .from("doc_opinion")
    .update(updatePayload)
    .eq("tenant_id", caller.tenantId)
    .eq("id", String(id));

  if (updateErr) {
    return withCors(
      JSON.stringify({ ok: false, error: { code: "DB_UPDATE_FAILED", message: updateErr.message } }),
      { status: 400, headers: { "Content-Type": "application/json" } },
      req,
    );
  }

  // Sync parapemptika links:
  // 1. Unlink all currently linked to this doc_opinion
  // 2. Link the new selected ones
  if (Array.isArray(parapemptiko_ids)) {
    const { error: unlinkErr } = await admin
      .from("parapemtiko")
      .update({ doc_opinion_id: null })
      .eq("tenant_id", caller.tenantId)
      .eq("doc_opinion_id", String(id));

    if (unlinkErr) {
      return withCors(
        JSON.stringify({ ok: false, error: { code: "UNLINK_FAILED", message: unlinkErr.message } }),
        { status: 400, headers: { "Content-Type": "application/json" } },
        req,
      );
    }

    const ids = parapemptiko_ids.filter(Boolean);
    if (ids.length > 0) {
      const { error: linkErr } = await admin
        .from("parapemtiko")
        .update({ doc_opinion_id: String(id) })
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
  }

  return withCors(
    JSON.stringify({ ok: true }),
    { status: 200, headers: { "Content-Type": "application/json" } },
    req,
  );
});

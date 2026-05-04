// supabase/functions/student-bulk-delete/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import { withCors } from "../_shared/cors.ts";
import { adminClient, authedClient } from "../_shared/supabase.ts";
import { getCallerProfileOrFail } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return withCors(null, { status: 204 }, req);
  if (req.method !== "POST") {
    return withCors(
      JSON.stringify({ ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" } }),
      { status: 405 },
      req,
    );
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return withCors(
      JSON.stringify({ ok: false, error: { code: "INVALID_JSON", message: "Invalid JSON body" } }),
      { status: 400 },
      req,
    );
  }

  const { ids } = payload ?? {};

  if (!Array.isArray(ids) || ids.length === 0) {
    return withCors(
      JSON.stringify({ ok: false, error: { code: "MISSING_FIELDS", message: "Το πεδίο ids είναι υποχρεωτικό και δεν μπορεί να είναι κενό." } }),
      { status: 400 },
      req,
    );
  }

  const userClient = authedClient(req);
  const caller = await getCallerProfileOrFail(req, userClient);
  if (!caller.ok) return caller.res;

  const admin = adminClient();

  // 1. Βρες τα doc_opinion IDs των μαθητών
  const { data: docOpinions, error: docFetchErr } = await admin
    .from("doc_opinion")
    .select("id")
    .eq("tenant_id", caller.tenantId)
    .in("student_id", ids);

  if (docFetchErr) {
    return withCors(
      JSON.stringify({ ok: false, error: { code: "DB_FETCH_FAILED", message: docFetchErr.message } }),
      { status: 400 },
      req,
    );
  }

  const docOpinionIds = (docOpinions ?? []).map((d: any) => d.id);

  // 2. Διέγραψε παραπεμπτικά που αναφέρονται στα doc_opinions αυτών των μαθητών
  if (docOpinionIds.length > 0) {
    const { error: parapErr } = await admin
      .from("parapemtiko")
      .delete()
      .in("doc_opinion_id", docOpinionIds);

    if (parapErr) {
      return withCors(
        JSON.stringify({ ok: false, error: { code: "DB_DELETE_FAILED", message: parapErr.message } }),
        { status: 400 },
        req,
      );
    }
  }

  // 3. Διέγραψε τα doc_opinions
  if (docOpinionIds.length > 0) {
    const { error: docDelErr } = await admin
      .from("doc_opinion")
      .delete()
      .eq("tenant_id", caller.tenantId)
      .in("student_id", ids);

    if (docDelErr) {
      return withCors(
        JSON.stringify({ ok: false, error: { code: "DB_DELETE_FAILED", message: docDelErr.message } }),
        { status: 400 },
        req,
      );
    }
  }

  // 4. Διέγραψε τον μαθητή από όλα τα class_sessions
  const { error: sessionStudentsErr } = await admin
    .from("class_session_students")
    .delete()
    .in("student_id", ids);

  if (sessionStudentsErr) {
    return withCors(
      JSON.stringify({ ok: false, error: { code: "DB_DELETE_FAILED", message: sessionStudentsErr.message } }),
      { status: 400 },
      req,
    );
  }

  // 5. Διέγραψε τους μαθητές
  const { error } = await admin
    .from("students")
    .delete()
    .eq("tenant_id", caller.tenantId)
    .in("user_id", ids);

  if (error) {
    return withCors(
      JSON.stringify({ ok: false, error: { code: "DB_DELETE_FAILED", message: error.message } }),
      { status: 400 },
      req,
    );
  }

  return withCors(
    JSON.stringify({ ok: true, data: { deleted: ids.length } }),
    { status: 200 },
    req,
  );
});

// supabase/functions/teacher-delete/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import { withCors } from "../_shared/cors.ts";
import { adminClient, authedClient } from "../_shared/supabase.ts";
import { getCallerProfileOrFail } from "../_shared/auth.ts";

serve(async (req) => {
  console.log("teacher-delete HIT", req.method, "origin:", req.headers.get("origin"));

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

  const { id } = payload ?? {};

  if (!id) {
    return withCors(
      JSON.stringify({
        ok: false,
        error: { code: "MISSING_FIELDS", message: "Το id είναι υποχρεωτικό." },
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
      req,
    );
  }

  const userClient = authedClient(req);
  const caller = await getCallerProfileOrFail(req, userClient);
  if (!caller.ok) return caller.res;

  const admin = adminClient();

  // verify the teacher belongs to the caller's tenant before deleting
  const { data: teacherRow, error: checkErr } = await admin
    .from("teacher")
    .select("id, tenant_id")
    .eq("tenant_id", caller.tenantId)
    .eq("id", String(id))
    .maybeSingle();

  if (checkErr) {
    return withCors(
      JSON.stringify({ ok: false, error: { code: "DB_CHECK_FAILED", message: checkErr.message } }),
      { status: 400, headers: { "Content-Type": "application/json" } },
      req,
    );
  }

  if (!teacherRow) {
    return withCors(
      JSON.stringify({
        ok: false,
        error: { code: "NOT_FOUND", message: "Ο εκπαιδευτικός δεν βρέθηκε στο tenant σου." },
      }),
      { status: 404, headers: { "Content-Type": "application/json" } },
      req,
    );
  }

  const { error } = await admin
    .from("teacher")
    .delete()
    .eq("tenant_id", caller.tenantId)
    .eq("id", String(id));

  if (error) {
    return withCors(
      JSON.stringify({ ok: false, error: { code: "DB_DELETE_FAILED", message: error.message } }),
      { status: 400, headers: { "Content-Type": "application/json" } },
      req,
    );
  }

  return withCors(
    JSON.stringify({ ok: true, data: { id } }),
    { status: 200, headers: { "Content-Type": "application/json" } },
    req,
  );
});
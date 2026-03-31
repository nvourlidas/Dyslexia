// supabase/functions/teacher-update/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import { withCors } from "../_shared/cors.ts";
import { adminClient, authedClient } from "../_shared/supabase.ts";
import { getCallerProfileOrFail } from "../_shared/auth.ts";

serve(async (req) => {
  console.log("teacher-update HIT", req.method, "origin:", req.headers.get("origin"));

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

  const { id, name, last_name, phone, email, idikotita, active } = payload ?? {};

  if (!id || !name || !last_name) {
    return withCors(
      JSON.stringify({
        ok: false,
        error: { code: "MISSING_FIELDS", message: "Το id, όνομα και επώνυμο είναι υποχρεωτικά." },
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
      req,
    );
  }

  const userClient = authedClient(req);
  const caller = await getCallerProfileOrFail(req, userClient);
  if (!caller.ok) return caller.res;

  const admin = adminClient();

  const updatePayload = {
    name: String(name).trim(),
    last_name: String(last_name).trim(),
    phone: phone ? String(phone).trim() : null,
    email: email ? String(email).trim() : null,
    idikotita: idikotita ? String(idikotita).trim() : null,
    active: active ?? true,
    updated_at: new Date().toISOString(),
  };

  const { error } = await admin
    .from("teacher")
    .update(updatePayload)
    .eq("tenant_id", caller.tenantId)
    .eq("id", String(id));

  if (error) {
    return withCors(
      JSON.stringify({ ok: false, error: { code: "DB_UPDATE_FAILED", message: error.message } }),
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

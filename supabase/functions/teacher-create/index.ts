// supabase/functions/teacher-create/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import { withCors } from "../_shared/cors.ts";
import { adminClient, authedClient } from "../_shared/supabase.ts";
import { getCallerProfileOrFail } from "../_shared/auth.ts";

serve(async (req) => {
  console.log("teacher-create HIT", req.method, "origin:", req.headers.get("origin"));

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

  const { name, last_name, phone, email, idikotita, active } = payload ?? {};

  if (!name || !last_name) {
    return withCors(
      JSON.stringify({
        ok: false,
        error: { code: "MISSING_FIELDS", message: "Το όνομα και το επώνυμο είναι υποχρεωτικά." },
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
      req,
    );
  }

  const userClient = authedClient(req);
  const caller = await getCallerProfileOrFail(req, userClient);
  if (!caller.ok) return caller.res;

  const admin = adminClient();
  const newId = crypto.randomUUID();

  const insertPayload = {
    id: newId,
    tenant_id: caller.tenantId,
    name: String(name).trim(),
    last_name: String(last_name).trim(),
    phone: phone ? String(phone).trim() : null,
    email: email ? String(email).trim() : null,
    idikotita: idikotita ? String(idikotita).trim() : null,
    active: active ?? true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await admin.from("teacher").insert(insertPayload);

  if (error) {
    return withCors(
      JSON.stringify({ ok: false, error: { code: "DB_INSERT_FAILED", message: error.message } }),
      { status: 400, headers: { "Content-Type": "application/json" } },
      req,
    );
  }

  return withCors(
    JSON.stringify({ ok: true, data: { id: newId } }),
    { status: 200, headers: { "Content-Type": "application/json" } },
    req,
  );
});

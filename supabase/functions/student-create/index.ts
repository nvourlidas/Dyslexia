//student-create

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import { withCors } from "../_shared/cors.ts";
import { adminClient, authedClient } from "../_shared/supabase.ts";
import { getCallerProfileOrFail } from "../_shared/auth.ts";

serve(async (req) => {
    console.log("HIT", req.method, "origin:", req.headers.get("origin"));
  if (req.method === "OPTIONS") return withCors(null, { status: 204 }, req);
  if (req.method !== "POST") {
    return withCors("Method not allowed", { status: 405 }, req);
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return withCors(
      JSON.stringify({ error: "invalid_json" }),
      { status: 400 },
      req,
    );
  }

  const {
    name,
    lastname,
    phone,
    email,
    city,
    address,
    amka,
    gender,
    birthdate,
    parent_name,
    parent_phone1,
    parent_phone2,
    active,
    doctor_visit,
    doctor_name,
  } = payload || {};

  if (!name || !lastname) {
    return withCors(JSON.stringify({ error: "missing_fields" }), {
      status: 400,
    }, req);
  }

  const userClient = authedClient(req);
  const caller = await getCallerProfileOrFail(req, userClient);
  if (!caller.ok) return caller.res;

  const admin = adminClient();

  const newId = (crypto as any).randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

  const insertPayload = {
    user_id: newId,
    tenant_id: caller.tenantId,

    name: String(name).trim(),
    lastname: String(lastname).trim(),
    phone: phone ? String(phone).trim() : null,
    email: email ? String(email).trim() : null,

    city: city ? String(city).trim() : null,
    address: address ? String(address).trim() : null,

    amka: amka ? String(amka).trim() : null,
    gender: gender ?? "unknown",
    birthdate: birthdate || null,

    parent_name: parent_name ? String(parent_name).trim() : null,
    parent_phone1: parent_phone1 ? String(parent_phone1).trim() : null,
    parent_phone2: parent_phone2 ? String(parent_phone2).trim() : null,

    active: active ?? true,
    doctor_visit: doctor_visit ?? false,
    doctor_name: doctor_name ? String(doctor_name).trim() : null,

    created_at: new Date().toISOString(),
    updated_at: null,
  };

  const { error } = await admin.from("students").insert(insertPayload);

  if (error) {
    return withCors(
      JSON.stringify({
        ok: false,
        error: { code: "DB_INSERT_FAILED", message: error.message },
      }),
      { status: 400 },
      req,
    );
  }

  return withCors(
    JSON.stringify({ ok: true, data: { id: newId } }),
    { status: 200 },
    req,
  );
});

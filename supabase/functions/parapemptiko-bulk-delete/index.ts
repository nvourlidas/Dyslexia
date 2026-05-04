// supabase/functions/parapemptiko-bulk-delete/index.ts
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

  const { error } = await admin
    .from("parapemtiko")
    .delete()
    .eq("tenant_id", caller.tenantId)
    .in("id", ids);

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

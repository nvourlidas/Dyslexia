// supabase/functions/class-update/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { withCors } from "../_shared/cors.ts";
import { adminClient, authedClient } from "../_shared/supabase.ts";
import { getCallerProfileOrFail } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return withCors(null, { status: 204 }, req);
  if (req.method !== "POST")
    return withCors(JSON.stringify({ ok: false, error: { code: "METHOD_NOT_ALLOWED" } }), { status: 405 }, req);

  let payload: any;
  try { payload = await req.json(); }
  catch { return withCors(JSON.stringify({ ok: false, error: { code: "INVALID_JSON" } }), { status: 400 }, req); }

  const { id, title, description, active } = payload ?? {};

  if (!id || !title || !String(title).trim())
    return withCors(JSON.stringify({ ok: false, error: { code: "MISSING_FIELDS", message: "id και title είναι υποχρεωτικά." } }), { status: 400 }, req);

  const userClient = authedClient(req);
  const caller = await getCallerProfileOrFail(req, userClient);
  if (!caller.ok) return caller.res;

  const admin = adminClient();

  const { error } = await admin
    .from("classes")
    .update({
      title: String(title).trim(),
      description: description ? String(description).trim() : null,
      active: active ?? true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", String(id))
    .eq("tenant_id", caller.tenantId);

  if (error)
    return withCors(JSON.stringify({ ok: false, error: { code: "DB_UPDATE_FAILED", message: error.message } }), { status: 400 }, req);

  return withCors(JSON.stringify({ ok: true, data: { id } }), { status: 200 }, req);
});

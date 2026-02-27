// supabase/functions/_shared/supabase.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

function mustGet(name: string) {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export function adminClient() {
  const url = mustGet("SUPABASE_URL");
  const serviceKey = mustGet("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

export function authedClient(req: Request) {
  const url = mustGet("SUPABASE_URL");
  const anonKey = mustGet("SUPABASE_ANON_KEY");

  const authHeader = req.headers.get("authorization") ?? "";

  return createClient(url, anonKey, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: authHeader, // "Bearer <jwt>"
      },
    },
  });
}
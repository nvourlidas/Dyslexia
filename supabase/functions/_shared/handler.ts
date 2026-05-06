// supabase/functions/_shared/handler.ts
import { withCors } from "./cors.ts";
import { authedClient } from "./supabase.ts";
import { getCallerProfileOrFail } from "./auth.ts";

type HandlerFn = (
  payload: any,
  tenantId: string,
  profile: any,
  req: Request,
) => Promise<Response>;

export function postHandler(fn: HandlerFn) {
  return Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return withCors(null, { status: 204 }, req);
    if (req.method !== "POST") {
      return withCors(
        JSON.stringify({ ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" } }),
        { status: 405 },
        req,
      );
    }

    let payload: any = {};
    try {
      payload = await req.json();
    } catch {
      return withCors(
        JSON.stringify({ ok: false, error: { code: "INVALID_JSON", message: "Invalid JSON body" } }),
        { status: 400 },
        req,
      );
    }

    const userClient = authedClient(req);
    const caller = await getCallerProfileOrFail(req, userClient);
    if (!caller.ok) return caller.res;

    try {
      return await fn(payload, caller.tenantId, caller.profile, req);
    } catch (err: any) {
      console.error("UNCAUGHT ERROR:", err?.message, err?.stack);
      return withCors(
        JSON.stringify({ ok: false, error: { code: "INTERNAL", message: err?.message ?? "Internal error" } }),
        { status: 500 },
        req,
      );
    }
  });
}

export function ok(data: any, req: Request): Response {
  return withCors(JSON.stringify({ ok: true, data }), { status: 200 }, req);
}

export function fail(code: string, message: string, req: Request, status = 400): Response {
  return withCors(
    JSON.stringify({ ok: false, error: { code, message } }),
    { status },
    req,
  );
}

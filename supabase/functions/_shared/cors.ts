/** 🔐 Set your allowed origins here */
export const ALLOWED = new Set<string>([
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "https://ctgym.cloudtec.gr",
]);

export function buildCors(req: Request) {
    const origin = req.headers.get("origin") ?? "";
    const allowOrigin = ALLOWED.has(origin) ? origin : "";
    const reqHdrs = req.headers.get("access-control-request-headers") ?? "";

    return {
        "Access-Control-Allow-Origin": allowOrigin,
        "Vary": "Origin",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": reqHdrs ||
            "authorization, x-client-info, apikey, content-type",
        "Access-Control-Max-Age": "86400",
    };
}

export function withCors(
    body: BodyInit | null,
    init: ResponseInit,
    req: Request,
) {
    return new Response(body, {
        ...init,
        headers: { ...(init.headers || {}), ...buildCors(req) },
    });
}

// supabase/functions/_shared/auth.ts
import { withCors } from "./cors.ts";

type CallerOk = {
  ok: true;
  tenantId: string;
  profile: any;
};

type CallerFail = {
  ok: false;
  res: Response;
};

export async function getCallerProfileOrFail(
  req: Request,
  userClient: any,
): Promise<CallerOk | CallerFail> {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");

  const { data: u, error: uErr } = await userClient.auth.getUser(token);
  console.log("getUser result:", JSON.stringify(uErr), u?.user?.id);

  if (uErr || !u?.user) {
    return {
      ok: false,
      res: withCors(
        JSON.stringify({
          ok: false,
          error: { code: "INVALID_JWT", message: uErr?.message ?? "Invalid JWT" },
        }),
        { status: 401 },
        req,
      ),
    };
  }

  const userId = u.user.id;

  const { data: prof, error: pErr } = await userClient
    .from("profiles")
    .select("id, tenant_id, role")
    .eq("id", userId)
    .maybeSingle();

  if (pErr || !prof?.tenant_id) {
    return {
      ok: false,
      res: withCors(
        JSON.stringify({
          ok: false,
          error: { code: "NO_TENANT", message: "No tenant in profile" },
        }),
        { status: 403 },
        req,
      ),
    };
  }

  return { ok: true, tenantId: prof.tenant_id, profile: prof };
}
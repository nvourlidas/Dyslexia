// supabase/functions/tests/helpers/harness.ts
//
// Spawns an edge function (its real index.ts, unmodified) as a subprocess with
// SUPABASE_URL pointing at the in-process mock backend (mock_supabase.ts),
// and provides request/assertion helpers plus shared tenant fixtures.
//
// Both `serve` (std) and `Deno.serve` listen on port 8000 by default, so
// functions are started one at a time and torn down before the next one.

import { fromFileUrl } from "jsr:@std/path@1";
import { assertEquals } from "jsr:@std/assert@1";
import { startMockSupabase, type MockSupabase } from "./mock_supabase.ts";

export const FUNCTION_PORT = 8000;
export const ORIGIN = "http://localhost:5173"; // in the CORS allowlist

// ---- Tenant fixtures ----
export const TENANT_A = "aaaaaaaa-0000-0000-0000-000000000001";
export const TENANT_B = "bbbbbbbb-0000-0000-0000-000000000002";

export const USER_A = "11111111-0000-0000-0000-00000000000a";
export const USER_B = "22222222-0000-0000-0000-00000000000b";
export const USER_NO_TENANT = "33333333-0000-0000-0000-00000000000c";

export const TOKEN_A = "token-tenant-a";
export const TOKEN_B = "token-tenant-b";
export const TOKEN_NO_TENANT = "token-no-tenant";

/** Registers auth users + profiles for tenant A, tenant B and a tenant-less user. */
export function seedBase(mock: MockSupabase) {
  const db = mock.db;
  db.addUser({ token: TOKEN_A, id: USER_A });
  db.addUser({ token: TOKEN_B, id: USER_B });
  db.addUser({ token: TOKEN_NO_TENANT, id: USER_NO_TENANT });
  db.insertRow("profiles", { id: USER_A, tenant_id: TENANT_A, role: "admin" });
  db.insertRow("profiles", { id: USER_B, tenant_id: TENANT_B, role: "admin" });
  db.insertRow("profiles", { id: USER_NO_TENANT, tenant_id: null, role: "admin" });
}

export interface RunningFunction {
  url: string;
  stop(): Promise<void>;
}

export async function startFunction(name: string, supabaseUrl: string): Promise<RunningFunction> {
  const indexPath = fromFileUrl(new URL(`../../${name}/index.ts`, import.meta.url));
  const proc = new Deno.Command(Deno.execPath(), {
    args: ["run", "--quiet", "--allow-net", "--allow-env", indexPath],
    env: {
      SUPABASE_URL: supabaseUrl,
      SUPABASE_ANON_KEY: "test-anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
      NO_COLOR: "1",
    },
    stdout: "null",
    stderr: "null",
  }).spawn();

  const url = `http://127.0.0.1:${FUNCTION_PORT}`;

  // Wait until the server accepts requests (first run may compile/download deps).
  const deadline = Date.now() + 60_000;
  while (true) {
    try {
      const res = await fetch(url, { method: "OPTIONS" });
      await res.body?.cancel();
      break;
    } catch {
      if (Date.now() > deadline) {
        try { proc.kill(); } catch { /* already dead */ }
        await proc.status;
        throw new Error(`function ${name} did not start within 60s`);
      }
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  return {
    url,
    async stop() {
      try { proc.kill(); } catch { /* already dead */ }
      await proc.status;
    },
  };
}

/** Starts mock + function, runs `body`, guarantees teardown. */
export async function withFunction(
  name: string,
  body: (fn: RunningFunction, mock: MockSupabase) => Promise<void>,
) {
  const mock = await startMockSupabase();
  seedBase(mock);
  const fn = await startFunction(name, mock.url);
  try {
    await body(fn, mock);
  } finally {
    await fn.stop();
    await mock.stop();
  }
}

export interface CallResult {
  status: number;
  headers: Headers;
  /** Parsed JSON body, or the raw text when not parseable, or null when empty. */
  body: any;
  rawText: string;
}

export async function call(
  url: string,
  opts: {
    method?: string;
    token?: string | null;
    body?: unknown;
    /** Send this exact string as the body (e.g. malformed JSON). */
    rawBody?: string;
    origin?: string;
  } = {},
): Promise<CallResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Origin: opts.origin ?? ORIGIN,
  };
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;

  const method = opts.method ?? "POST";
  const bodyStr = opts.rawBody !== undefined
    ? opts.rawBody
    : opts.body !== undefined
    ? JSON.stringify(opts.body)
    : undefined;

  const res = await fetch(url, {
    method,
    headers,
    body: method === "GET" || method === "OPTIONS" ? undefined : bodyStr,
  });
  const rawText = await res.text();
  let body: any = null;
  if (rawText !== "") {
    try {
      body = JSON.parse(rawText);
    } catch {
      body = rawText;
    }
  }
  return { status: res.status, headers: res.headers, body, rawText };
}

/** Asserts the standard CORS headers for an allowed origin. */
export function assertCors(headers: Headers, origin = ORIGIN) {
  assertEquals(headers.get("access-control-allow-origin"), origin);
  const methods = headers.get("access-control-allow-methods") ?? "";
  if (!methods.includes("POST") || !methods.includes("OPTIONS")) {
    throw new Error(`Access-Control-Allow-Methods missing POST/OPTIONS: "${methods}"`);
  }
  if (!headers.get("access-control-allow-headers")) {
    throw new Error("Access-Control-Allow-Headers header missing");
  }
}

/** Asserts the failure envelope { ok:false, error:{ code } } and returns the error. */
export function assertFailEnvelope(res: CallResult, status: number, code: string) {
  assertEquals(res.status, status, `expected status ${status}, got ${res.status}: ${res.rawText}`);
  assertEquals(typeof res.body, "object", `body is not JSON: ${res.rawText}`);
  assertEquals(res.body?.ok, false, `expected ok:false envelope: ${res.rawText}`);
  assertEquals(res.body?.error?.code, code, `expected error.code ${code}: ${res.rawText}`);
  if (typeof res.body?.error?.message !== "string" || res.body.error.message.length === 0) {
    throw new Error(`error.message missing or empty: ${res.rawText}`);
  }
  return res.body.error;
}

/** Asserts the success envelope { ok:true, data } and returns data. */
export function assertOkEnvelope(res: CallResult, status = 200) {
  assertEquals(res.status, status, `expected status ${status}, got ${res.status}: ${res.rawText}`);
  assertEquals(res.body?.ok, true, `expected ok:true envelope: ${res.rawText}`);
  return res.body.data;
}

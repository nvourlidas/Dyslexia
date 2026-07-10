// supabase/functions/tests/teacher-delete.integration_test.ts

import { assertEquals, assert } from "jsr:@std/assert@1";
import {
  withFunction, call, assertCors, assertFailEnvelope, assertOkEnvelope,
  TENANT_A, TENANT_B, TOKEN_A, TOKEN_B, TOKEN_NO_TENANT,
} from "./helpers/harness.ts";

const T1 = "62222222-0000-0000-0000-000000000001";
const T_WITH_SESSION = "62222222-0000-0000-0000-000000000002";

Deno.test("teacher-delete", async (t) => {
  await withFunction("teacher-delete", async (fn, mock) => {
    mock.db.insertRow("teacher", { id: T1, tenant_id: TENANT_A, name: "Α", last_name: "Ένα" });
    mock.db.insertRow("teacher", { id: T_WITH_SESSION, tenant_id: TENANT_A, name: "Β", last_name: "Δύο" });
    mock.db.insertRow("class_sessions", {
      id: "63333333-0000-0000-0000-000000000001",
      tenant_id: TENANT_A,
      teacher_id: T_WITH_SESSION,
      starts_at: "2026-07-01T10:00:00Z",
      ends_at: "2026-07-01T11:00:00Z",
    });

    await t.step("OPTIONS preflight → 204 with CORS headers", async () => {
      const res = await call(fn.url, { method: "OPTIONS" });
      assertEquals(res.status, 204);
      assertCors(res.headers);
    });

    await t.step("GET → 405 METHOD_NOT_ALLOWED envelope", async () => {
      const res = await call(fn.url, { method: "GET" });
      assertFailEnvelope(res, 405, "METHOD_NOT_ALLOWED");
      assertCors(res.headers);
    });

    await t.step("malformed JSON → 400 INVALID_JSON envelope", async () => {
      const res = await call(fn.url, { token: TOKEN_A, rawBody: "{{" });
      assertFailEnvelope(res, 400, "INVALID_JSON");
    });

    await t.step("auth runs before validation — no token + no id → 401", async () => {
      const res = await call(fn.url, { body: {} });
      assertFailEnvelope(res, 401, "INVALID_JWT");
    });

    await t.step("missing id → 400 MISSING_FIELDS", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: {} });
      assertFailEnvelope(res, 400, "MISSING_FIELDS");
    });

    await t.step("no token + valid body → 401 INVALID_JWT", async () => {
      const res = await call(fn.url, { body: { id: T1 } });
      assertFailEnvelope(res, 401, "INVALID_JWT");
      assertCors(res.headers);
    });

    await t.step("token without tenant → 403 NO_TENANT", async () => {
      const res = await call(fn.url, { token: TOKEN_NO_TENANT, body: { id: T1 } });
      assertFailEnvelope(res, 403, "NO_TENANT");
    });

    await t.step("unknown id → 404 NOT_FOUND", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { id: crypto.randomUUID() } });
      assertFailEnvelope(res, 404, "NOT_FOUND");
    });

    await t.step("tenant B token on tenant A's teacher → 404, row survives", async () => {
      const res = await call(fn.url, { token: TOKEN_B, body: { id: T1 } });
      assertFailEnvelope(res, 404, "NOT_FOUND");
      assert(mock.db.table("teacher").some((r) => r.id === T1));
    });

    await t.step("ownership-check DB failure → 400 DB_CHECK_FAILED envelope", async () => {
      mock.db.failNext("teacher", "select", { code: "XX000", message: "boom" });
      const res = await call(fn.url, { token: TOKEN_A, body: { id: T1 } });
      assertFailEnvelope(res, 400, "DB_CHECK_FAILED");
    });

    await t.step("FK violation (teacher has sessions) → 409 CONFLICT envelope", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { id: T_WITH_SESSION } });
      assertFailEnvelope(res, 409, "CONFLICT");
      assert(mock.db.table("teacher").some((r) => r.id === T_WITH_SESSION), "row must survive the failed delete");
    });

    await t.step("happy path → 200 {ok,data:{id}}, row removed", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { id: T1 } });
      const data = assertOkEnvelope(res);
      assertEquals(data.id, T1);
      assertCors(res.headers);
      assertEquals(mock.db.table("teacher").some((r) => r.id === T1), false);
    });
  });
});

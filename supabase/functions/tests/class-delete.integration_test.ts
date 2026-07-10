// supabase/functions/tests/class-delete.integration_test.ts

import { assertEquals, assert } from "jsr:@std/assert@1";
import {
  withFunction, call, assertCors, assertFailEnvelope, assertOkEnvelope,
  TENANT_A, TENANT_B, TOKEN_A, TOKEN_B, TOKEN_NO_TENANT,
} from "./helpers/harness.ts";

const C1 = "82222222-0000-0000-0000-000000000001";
const C_WITH_SESSION = "82222222-0000-0000-0000-000000000002";

Deno.test("class-delete", async (t) => {
  await withFunction("class-delete", async (fn, mock) => {
    mock.db.insertRow("classes", { id: C1, tenant_id: TENANT_A, title: "Τμήμα 1" });
    mock.db.insertRow("classes", { id: C_WITH_SESSION, tenant_id: TENANT_A, title: "Τμήμα 2" });
    mock.db.insertRow("class_sessions", {
      id: "83333333-0000-0000-0000-000000000001",
      tenant_id: TENANT_A,
      class_id: C_WITH_SESSION,
      teacher_id: null,
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
      const res = await call(fn.url, { token: TOKEN_A, rawBody: "-" });
      assertFailEnvelope(res, 400, "INVALID_JSON");
    });

    await t.step("auth runs before validation — no token + no id → 401", async () => {
      const res = await call(fn.url, { body: {} });
      assertFailEnvelope(res, 401, "INVALID_JWT");
    });

    await t.step("no token + valid body → 401 INVALID_JWT", async () => {
      const res = await call(fn.url, { body: { id: C1 } });
      assertFailEnvelope(res, 401, "INVALID_JWT");
      assertCors(res.headers);
    });

    await t.step("token without tenant → 403 NO_TENANT", async () => {
      const res = await call(fn.url, { token: TOKEN_NO_TENANT, body: { id: C1 } });
      assertFailEnvelope(res, 403, "NO_TENANT");
    });

    await t.step("unknown id → 404 NOT_FOUND envelope", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { id: crypto.randomUUID() } });
      assertFailEnvelope(res, 404, "NOT_FOUND");
    });

    await t.step("tenant B token on tenant A's class → 404, row survives", async () => {
      const res = await call(fn.url, { token: TOKEN_B, body: { id: C1 } });
      assertFailEnvelope(res, 404, "NOT_FOUND");
      assert(mock.db.table("classes").some((r) => r.id === C1));
    });

    await t.step("ownership-check DB failure → 400 DB_CHECK_FAILED (was silently 404)", async () => {
      mock.db.failNext("classes", "select", { code: "XX000", message: "boom" });
      const res = await call(fn.url, { token: TOKEN_A, body: { id: C1 } });
      assertFailEnvelope(res, 400, "DB_CHECK_FAILED");
    });

    await t.step("FK violation (class has sessions) → 409 CONFLICT envelope", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { id: C_WITH_SESSION } });
      assertFailEnvelope(res, 409, "CONFLICT");
      assert(mock.db.table("classes").some((r) => r.id === C_WITH_SESSION), "row must survive the failed delete");
    });

    await t.step("happy path → 200 {ok,data:{id}}, row removed", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { id: C1 } });
      const data = assertOkEnvelope(res);
      assertEquals(data.id, C1);
      assertCors(res.headers);
      assertEquals(mock.db.table("classes").some((r) => r.id === C1), false);
    });
  });
});

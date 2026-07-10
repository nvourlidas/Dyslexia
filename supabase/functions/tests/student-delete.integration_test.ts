// supabase/functions/tests/student-delete.integration_test.ts

import { assertEquals, assert } from "jsr:@std/assert@1";
import {
  withFunction, call, assertCors, assertFailEnvelope, assertOkEnvelope,
  TENANT_A, TENANT_B, TOKEN_A, TOKEN_B, TOKEN_NO_TENANT,
} from "./helpers/harness.ts";

const STUDENT_1 = "52222222-0000-0000-0000-000000000001";
const STUDENT_2 = "52222222-0000-0000-0000-000000000002";
const STUDENT_WITH_CHILD = "52222222-0000-0000-0000-000000000003";

Deno.test("student-delete", async (t) => {
  await withFunction("student-delete", async (fn, mock) => {
    mock.db.insertRow("students", { user_id: STUDENT_1, tenant_id: TENANT_A, name: "Α", lastname: "Ένα" });
    mock.db.insertRow("students", { user_id: STUDENT_2, tenant_id: TENANT_A, name: "Β", lastname: "Δύο" });
    mock.db.insertRow("students", { user_id: STUDENT_WITH_CHILD, tenant_id: TENANT_A, name: "Γ", lastname: "Τρία" });
    mock.db.insertRow("doc_opinion", {
      id: "6ddddddd-0000-0000-0000-000000000001",
      tenant_id: TENANT_A,
      student_id: STUDENT_WITH_CHILD,
      start_date: "2026-01-01",
      status: "pending",
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
      const res = await call(fn.url, { token: TOKEN_A, rawBody: "{" });
      assertFailEnvelope(res, 400, "INVALID_JSON");
    });

    await t.step("auth runs before validation — no token + no user_id → 401", async () => {
      const res = await call(fn.url, { body: {} });
      assertFailEnvelope(res, 401, "INVALID_JWT");
    });

    await t.step("missing user_id → 400 MISSING_FIELDS envelope", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: {} });
      assertFailEnvelope(res, 400, "MISSING_FIELDS");
    });

    await t.step("no token + valid body → 401 INVALID_JWT envelope", async () => {
      const res = await call(fn.url, { body: { user_id: STUDENT_1 } });
      assertFailEnvelope(res, 401, "INVALID_JWT");
      assertCors(res.headers);
    });

    await t.step("token without tenant → 403 NO_TENANT", async () => {
      const res = await call(fn.url, { token: TOKEN_NO_TENANT, body: { user_id: STUDENT_1 } });
      assertFailEnvelope(res, 403, "NO_TENANT");
    });

    await t.step("happy path → 200 {ok,data:{user_id}}, row removed", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { user_id: STUDENT_1 } });
      const data = assertOkEnvelope(res);
      assertEquals(data.user_id, STUDENT_1);
      assertCors(res.headers);
      assertEquals(mock.db.table("students").some((r) => r.user_id === STUDENT_1), false);
    });

    await t.step("tenant B token on tenant A's student → row NOT deleted (silent ok)", async () => {
      const res = await call(fn.url, { token: TOKEN_B, body: { user_id: STUDENT_2 } });
      assertEquals(res.status, 200);
      assert(mock.db.table("students").some((r) => r.user_id === STUDENT_2), "cross-tenant delete must not remove the row");
    });

    await t.step("FK violation (student has doc_opinion) → 409 CONFLICT envelope", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { user_id: STUDENT_WITH_CHILD } });
      assertFailEnvelope(res, 409, "CONFLICT");
      assertCors(res.headers);
      assert(mock.db.table("students").some((r) => r.user_id === STUDENT_WITH_CHILD), "row must survive the failed delete");
    });

    await t.step("other DB failure → 400 DB_DELETE_FAILED envelope", async () => {
      mock.db.failNext("students", "delete", { code: "XX000", message: "connection reset" });
      const res = await call(fn.url, { token: TOKEN_A, body: { user_id: STUDENT_2 } });
      const err = assertFailEnvelope(res, 400, "DB_DELETE_FAILED");
      assertEquals(err.message, "connection reset");
    });
  });
});

// supabase/functions/tests/session-delete.integration_test.ts

import { assertEquals, assert } from "jsr:@std/assert@1";
import {
  withFunction, call, assertCors, assertFailEnvelope, assertOkEnvelope,
  TENANT_A, TENANT_B, TOKEN_A, TOKEN_B, TOKEN_NO_TENANT,
} from "./helpers/harness.ts";

const SESSION_1 = "96666666-0000-0000-0000-000000000001";
const STUDENT_A = "97777777-0000-0000-0000-000000000001";

Deno.test("session-delete", async (t) => {
  await withFunction("session-delete", async (fn, mock) => {
    mock.db.insertRow("students", { user_id: STUDENT_A, tenant_id: TENANT_A, name: "Μ", lastname: "Μαθητής" });
    mock.db.insertRow("class_sessions", {
      id: SESSION_1, tenant_id: TENANT_A, teacher_id: null, class_id: null,
      starts_at: "2026-07-15T10:00:00Z", ends_at: "2026-07-15T11:00:00Z", status: "scheduled",
    });
    mock.db.insertRow("class_session_students", {
      tenant_id: TENANT_A, session_id: SESSION_1, student_id: STUDENT_A, status: "present",
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
      const res = await call(fn.url, { token: TOKEN_A, rawBody: ";" });
      assertFailEnvelope(res, 400, "INVALID_JSON");
    });

    await t.step("auth runs before validation — no token + no id → 401", async () => {
      const res = await call(fn.url, { body: {} });
      assertFailEnvelope(res, 401, "INVALID_JWT");
    });

    await t.step("no token + valid body → 401 INVALID_JWT", async () => {
      const res = await call(fn.url, { body: { id: SESSION_1 } });
      assertFailEnvelope(res, 401, "INVALID_JWT");
      assertCors(res.headers);
    });

    await t.step("token without tenant → 403 NO_TENANT", async () => {
      const res = await call(fn.url, { token: TOKEN_NO_TENANT, body: { id: SESSION_1 } });
      assertFailEnvelope(res, 403, "NO_TENANT");
    });

    await t.step("unknown id → 404 NOT_FOUND envelope", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { id: crypto.randomUUID() } });
      assertFailEnvelope(res, 404, "NOT_FOUND");
    });

    await t.step("tenant B token on tenant A's session → 404, rows survive", async () => {
      const res = await call(fn.url, { token: TOKEN_B, body: { id: SESSION_1 } });
      assertFailEnvelope(res, 404, "NOT_FOUND");
      assert(mock.db.table("class_sessions").some((r) => r.id === SESSION_1));
      assertEquals(mock.db.table("class_session_students").length, 1);
    });

    await t.step("ownership-check DB failure → 400 DB_CHECK_FAILED (was silently 404)", async () => {
      mock.db.failNext("class_sessions", "select", { code: "XX000", message: "boom" });
      const res = await call(fn.url, { token: TOKEN_A, body: { id: SESSION_1 } });
      assertFailEnvelope(res, 400, "DB_CHECK_FAILED");
    });

    await t.step("attendance delete failure → 400 DB_DELETE_FAILED (was silently ignored)", async () => {
      mock.db.failNext("class_session_students", "delete", { code: "XX000", message: "boom" });
      const res = await call(fn.url, { token: TOKEN_A, body: { id: SESSION_1 } });
      assertFailEnvelope(res, 400, "DB_DELETE_FAILED");
      assert(mock.db.table("class_sessions").some((r) => r.id === SESSION_1), "session must survive if attendance cleanup failed");
    });

    await t.step("DB delete failure → 400 DB_DELETE_FAILED", async () => {
      mock.db.failNext("class_sessions", "delete", { code: "XX000", message: "boom" });
      const res = await call(fn.url, { token: TOKEN_A, body: { id: SESSION_1 } });
      assertFailEnvelope(res, 400, "DB_DELETE_FAILED");
    });

    await t.step("happy path → 200 {ok,data:{id}}, session + attendance removed", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { id: SESSION_1 } });
      const data = assertOkEnvelope(res);
      assertEquals(data.id, SESSION_1);
      assertCors(res.headers);
      assertEquals(mock.db.table("class_sessions").some((r) => r.id === SESSION_1), false);
      assertEquals(mock.db.table("class_session_students").filter((r) => r.session_id === SESSION_1).length, 0);
    });
  });
});

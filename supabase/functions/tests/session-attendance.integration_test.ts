// supabase/functions/tests/session-attendance.integration_test.ts

import { assertEquals, assert } from "jsr:@std/assert@1";
import {
  withFunction, call, assertCors, assertFailEnvelope, assertOkEnvelope,
  TENANT_A, TENANT_B, TOKEN_A, TOKEN_B, TOKEN_NO_TENANT, USER_A,
} from "./helpers/harness.ts";

const SESSION_1 = "98888888-0000-0000-0000-000000000001";
const STUDENT_A = "99999999-0000-0000-0000-000000000001";

Deno.test("session-attendance", async (t) => {
  await withFunction("session-attendance", async (fn, mock) => {
    mock.db.insertRow("students", { user_id: STUDENT_A, tenant_id: TENANT_A, name: "Μ", lastname: "Μαθητής" });
    mock.db.insertRow("class_sessions", {
      id: SESSION_1, tenant_id: TENANT_A, teacher_id: null,
      starts_at: "2026-07-15T10:00:00Z", ends_at: "2026-07-15T11:00:00Z", status: "scheduled",
    });
    mock.db.insertRow("class_session_students", {
      tenant_id: TENANT_A, session_id: SESSION_1, student_id: STUDENT_A, status: "present", marked_by: null,
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
      const res = await call(fn.url, { token: TOKEN_A, rawBody: "…" });
      assertFailEnvelope(res, 400, "INVALID_JSON");
    });

    await t.step("auth runs before validation — no token + missing fields → 401", async () => {
      const res = await call(fn.url, { body: {} });
      assertFailEnvelope(res, 401, "INVALID_JWT");
    });

    await t.step("invalid status value → 400 INVALID_STATUS", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { session_id: SESSION_1, status: "late" } });
      assertFailEnvelope(res, 400, "INVALID_STATUS");
    });

    await t.step("no token + valid body → 401 INVALID_JWT", async () => {
      const res = await call(fn.url, { body: { session_id: SESSION_1, status: "absent" } });
      assertFailEnvelope(res, 401, "INVALID_JWT");
      assertCors(res.headers);
    });

    await t.step("token without tenant → 403 NO_TENANT", async () => {
      const res = await call(fn.url, { token: TOKEN_NO_TENANT, body: { session_id: SESSION_1, status: "absent" } });
      assertFailEnvelope(res, 403, "NO_TENANT");
    });

    await t.step("unknown session → 404 NOT_FOUND envelope", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { session_id: crypto.randomUUID(), status: "absent" } });
      assertFailEnvelope(res, 404, "NOT_FOUND");
    });

    await t.step("tenant B token on tenant A's session → 404, attendance unchanged", async () => {
      const res = await call(fn.url, { token: TOKEN_B, body: { session_id: SESSION_1, status: "absent" } });
      assertFailEnvelope(res, 404, "NOT_FOUND");
      assertEquals(mock.db.table("class_session_students")[0].status, "present");
    });

    await t.step("happy path → 200 {ok,data:{session_id,status}}, row updated with marked_by", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { session_id: SESSION_1, status: "absent" } });
      const data = assertOkEnvelope(res);
      assertEquals(data.session_id, SESSION_1);
      assertEquals(data.status, "absent");
      assertCors(res.headers);

      const att = mock.db.table("class_session_students")[0];
      assertEquals(att.status, "absent");
      assertEquals(att.marked_by, USER_A, "marked_by must record the caller's profile id");
      assert(typeof att.marked_at === "string" && att.marked_at.length > 0);
    });

    await t.step("DB update failure → 400 DB_UPDATE_FAILED", async () => {
      mock.db.failNext("class_session_students", "update", { code: "XX000", message: "boom" });
      const res = await call(fn.url, { token: TOKEN_A, body: { session_id: SESSION_1, status: "present" } });
      assertFailEnvelope(res, 400, "DB_UPDATE_FAILED");
    });
  });
});

// supabase/functions/tests/session-update.integration_test.ts

import { assertEquals, assert } from "jsr:@std/assert@1";
import {
  withFunction, call, assertCors, assertFailEnvelope, assertOkEnvelope,
  TENANT_A, TENANT_B, TOKEN_A, TOKEN_B, TOKEN_NO_TENANT,
} from "./helpers/harness.ts";

const SESSION_1 = "94444444-0000-0000-0000-000000000001";
const STUDENT_A1 = "95555555-0000-0000-0000-000000000001";
const STUDENT_A2 = "95555555-0000-0000-0000-000000000002";
const STUDENT_B = "95555555-0000-0000-0000-00000000000b";

Deno.test("session-update", async (t) => {
  await withFunction("session-update", async (fn, mock) => {
    mock.db.insertRow("students", { user_id: STUDENT_A1, tenant_id: TENANT_A, name: "Α", lastname: "Ένα" });
    mock.db.insertRow("students", { user_id: STUDENT_A2, tenant_id: TENANT_A, name: "Β", lastname: "Δύο" });
    mock.db.insertRow("students", { user_id: STUDENT_B, tenant_id: TENANT_B, name: "Ξ", lastname: "Ξένος" });
    mock.db.insertRow("class_sessions", {
      id: SESSION_1, tenant_id: TENANT_A, teacher_id: null, class_id: null,
      starts_at: "2026-07-15T10:00:00Z", ends_at: "2026-07-15T11:00:00Z",
      status: "scheduled", notes: "παλιές",
    });
    mock.db.insertRow("class_session_students", {
      tenant_id: TENANT_A, session_id: SESSION_1, student_id: STUDENT_A1, status: "present",
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
      const res = await call(fn.url, { token: TOKEN_A, rawBody: "()" });
      assertFailEnvelope(res, 400, "INVALID_JSON");
    });

    await t.step("auth runs before validation — no token + no id → 401", async () => {
      const res = await call(fn.url, { body: {} });
      assertFailEnvelope(res, 401, "INVALID_JWT");
    });

    await t.step("no token + valid body → 401 INVALID_JWT", async () => {
      const res = await call(fn.url, { body: { id: SESSION_1, status: "done" } });
      assertFailEnvelope(res, 401, "INVALID_JWT");
      assertCors(res.headers);
    });

    await t.step("token without tenant → 403 NO_TENANT", async () => {
      const res = await call(fn.url, { token: TOKEN_NO_TENANT, body: { id: SESSION_1 } });
      assertFailEnvelope(res, 403, "NO_TENANT");
    });

    await t.step("partial update (status+notes) → 200, other fields untouched", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { id: SESSION_1, status: "done", notes: " νέες " } });
      const data = assertOkEnvelope(res);
      assertEquals(data.id, SESSION_1);
      assertCors(res.headers);

      const row = mock.db.table("class_sessions").find((r) => r.id === SESSION_1)!;
      assertEquals(row.status, "done");
      assertEquals(row.notes, "νέες");
      assertEquals(row.starts_at, "2026-07-15T10:00:00Z", "starts_at not sent → unchanged");
    });

    await t.step("unknown id → 404 NOT_FOUND", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { id: crypto.randomUUID(), status: "done" } });
      assertFailEnvelope(res, 404, "NOT_FOUND");
    });

    await t.step("tenant B token on tenant A's session → 404, row unchanged", async () => {
      const res = await call(fn.url, { token: TOKEN_B, body: { id: SESSION_1, status: "ΔΙΑΡΡΟΗ" } });
      assertFailEnvelope(res, 404, "NOT_FOUND");
      assertEquals(mock.db.table("class_sessions").find((r) => r.id === SESSION_1)?.status, "done");
    });

    await t.step("student_id: replaces the attendance row (same tenant)", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { id: SESSION_1, student_id: STUDENT_A2 } });
      assertOkEnvelope(res);
      const atts = mock.db.table("class_session_students").filter((r) => r.session_id === SESSION_1);
      assertEquals(atts.length, 1);
      assertEquals(atts[0].student_id, STUDENT_A2);
      assertEquals(atts[0].tenant_id, TENANT_A);
    });

    await t.step("student_id null → removes the attendance row", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { id: SESSION_1, student_id: null } });
      assertOkEnvelope(res);
      assertEquals(mock.db.table("class_session_students").filter((r) => r.session_id === SESSION_1).length, 0);
    });

    await t.step("student_id from another tenant → 404 NOT_FOUND, attendance untouched (fixed cross-tenant bug)", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { id: SESSION_1, student_id: STUDENT_B } });
      assertFailEnvelope(res, 404, "NOT_FOUND");
      const atts = mock.db.table("class_session_students").filter((r) => r.session_id === SESSION_1);
      assertEquals(atts.length, 0, "no attendance row may reference another tenant's student");
    });

    await t.step("attendance insert failure → 400 ATT_UPDATE_FAILED", async () => {
      mock.db.failNext("class_session_students", "insert", { code: "XX000", message: "boom" });
      const res = await call(fn.url, { token: TOKEN_A, body: { id: SESSION_1, student_id: STUDENT_A1 } });
      assertFailEnvelope(res, 400, "ATT_UPDATE_FAILED");
    });

    await t.step("DB update failure → 400 DB_UPDATE_FAILED", async () => {
      mock.db.failNext("class_sessions", "update", { code: "XX000", message: "boom" });
      const res = await call(fn.url, { token: TOKEN_A, body: { id: SESSION_1, status: "done" } });
      assertFailEnvelope(res, 400, "DB_UPDATE_FAILED");
    });
  });
});

// supabase/functions/tests/session-create.integration_test.ts
//
// session-create guards every client-supplied FK with assertOwnedIds:
// teacher_id, class_id, student_id must exist in the caller's tenant.

import { assertEquals, assert } from "jsr:@std/assert@1";
import {
  withFunction, call, assertCors, assertFailEnvelope, assertOkEnvelope,
  TENANT_A, TENANT_B, TOKEN_A, TOKEN_NO_TENANT,
} from "./helpers/harness.ts";

const TEACHER_A = "91111111-0000-0000-0000-000000000001";
const TEACHER_B = "91111111-0000-0000-0000-00000000000b";
const STUDENT_A = "92222222-0000-0000-0000-000000000001";
const STUDENT_B = "92222222-0000-0000-0000-00000000000b";
const CLASS_A = "93333333-0000-0000-0000-000000000001";

const VALID = {
  teacher_id: TEACHER_A,
  starts_at: "2026-07-15T10:00:00Z",
  ends_at: "2026-07-15T11:00:00Z",
};

Deno.test("session-create", async (t) => {
  await withFunction("session-create", async (fn, mock) => {
    mock.db.insertRow("teacher", { id: TEACHER_A, tenant_id: TENANT_A, name: "Α", last_name: "Δάσκαλος" });
    mock.db.insertRow("teacher", { id: TEACHER_B, tenant_id: TENANT_B, name: "Ξ", last_name: "Δάσκαλος" });
    mock.db.insertRow("students", { user_id: STUDENT_A, tenant_id: TENANT_A, name: "Μ", lastname: "Μαθητής" });
    mock.db.insertRow("students", { user_id: STUDENT_B, tenant_id: TENANT_B, name: "Ξ", lastname: "Μαθητής" });
    mock.db.insertRow("classes", { id: CLASS_A, tenant_id: TENANT_A, title: "Τμήμα" });

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
      const res = await call(fn.url, { token: TOKEN_A, rawBody: "x" });
      assertFailEnvelope(res, 400, "INVALID_JSON");
    });

    await t.step("auth runs before validation — no token + missing fields → 401", async () => {
      const res = await call(fn.url, { body: {} });
      assertFailEnvelope(res, 401, "INVALID_JWT");
    });

    await t.step("missing ends_at → 400 MISSING_FIELDS", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { teacher_id: TEACHER_A, starts_at: VALID.starts_at } });
      assertFailEnvelope(res, 400, "MISSING_FIELDS");
    });

    await t.step("no token + valid body → 401 INVALID_JWT", async () => {
      const res = await call(fn.url, { body: VALID });
      assertFailEnvelope(res, 401, "INVALID_JWT");
      assertCors(res.headers);
    });

    await t.step("token without tenant → 403 NO_TENANT", async () => {
      const res = await call(fn.url, { token: TOKEN_NO_TENANT, body: VALID });
      assertFailEnvelope(res, 403, "NO_TENANT");
    });

    await t.step("teacher from another tenant → 404 NOT_FOUND, no session created", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { ...VALID, teacher_id: TEACHER_B } });
      assertFailEnvelope(res, 404, "NOT_FOUND");
      assertEquals(mock.db.table("class_sessions").length, 0);
    });

    await t.step("student from another tenant → 404 NOT_FOUND, no session created", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { ...VALID, student_id: STUDENT_B } });
      assertFailEnvelope(res, 404, "NOT_FOUND");
      assertEquals(mock.db.table("class_sessions").length, 0);
    });

    await t.step("unknown class_id → 404 NOT_FOUND", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { ...VALID, class_id: crypto.randomUUID() } });
      assertFailEnvelope(res, 404, "NOT_FOUND");
    });

    await t.step("happy path with student → session + attendance rows, tenant-scoped", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { ...VALID, student_id: STUDENT_A, class_id: CLASS_A, notes: " σημ. " } });
      const data = assertOkEnvelope(res);
      assert(typeof data.id === "string" && data.id.length > 0);
      assertCors(res.headers);

      const session = mock.db.table("class_sessions").find((r) => r.id === data.id)!;
      assertEquals(session.tenant_id, TENANT_A);
      assertEquals(session.teacher_id, TEACHER_A);
      assertEquals(session.class_id, CLASS_A);
      assertEquals(session.status, "scheduled");
      assertEquals(session.notes, "σημ.");

      const att = mock.db.table("class_session_students").find((r) => r.session_id === data.id)!;
      assertEquals(att.tenant_id, TENANT_A);
      assertEquals(att.student_id, STUDENT_A);
      assertEquals(att.status, "present");
    });

    await t.step("happy path without student/class → session only", async () => {
      const before = mock.db.table("class_session_students").length;
      const res = await call(fn.url, { token: TOKEN_A, body: VALID });
      const data = assertOkEnvelope(res);
      assertEquals(mock.db.table("class_session_students").length, before);
      assertEquals(mock.db.table("class_sessions").find((r) => r.id === data.id)?.class_id, null);
    });

    await t.step("session insert failure → 400 DB_INSERT_FAILED", async () => {
      mock.db.failNext("class_sessions", "insert", { code: "XX000", message: "boom" });
      const res = await call(fn.url, { token: TOKEN_A, body: VALID });
      assertFailEnvelope(res, 400, "DB_INSERT_FAILED");
    });

    await t.step("attendance insert failure → 400 ATT_INSERT_FAILED (session row remains)", async () => {
      const before = mock.db.table("class_sessions").length;
      mock.db.failNext("class_session_students", "insert", { code: "XX000", message: "boom" });
      const res = await call(fn.url, { token: TOKEN_A, body: { ...VALID, student_id: STUDENT_A } });
      assertFailEnvelope(res, 400, "ATT_INSERT_FAILED");
      assertEquals(mock.db.table("class_sessions").length, before + 1, "known behavior: orphan session row remains");
    });
  });
});

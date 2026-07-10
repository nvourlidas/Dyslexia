// supabase/functions/tests/student-bulk-delete.integration_test.ts
//
// student-bulk-delete manually cascades: parapemtiko → doc_opinion →
// class_session_students → students, all tenant-scoped.

import { assertEquals, assert } from "jsr:@std/assert@1";
import {
  withFunction, call, assertCors, assertFailEnvelope, assertOkEnvelope,
  TENANT_A, TENANT_B, TOKEN_A, TOKEN_NO_TENANT,
} from "./helpers/harness.ts";

const S1 = "53333333-0000-0000-0000-000000000001";
const S2 = "53333333-0000-0000-0000-000000000002";
const S_B = "53333333-0000-0000-0000-00000000000b"; // tenant B's student

function seed(mock: { db: { insertRow(t: string, r: Record<string, unknown>): void } }) {
  mock.db.insertRow("students", { user_id: S1, tenant_id: TENANT_A, name: "Ένα", lastname: "Α" });
  mock.db.insertRow("students", { user_id: S2, tenant_id: TENANT_A, name: "Δύο", lastname: "Β" });
  mock.db.insertRow("students", { user_id: S_B, tenant_id: TENANT_B, name: "Ξένος", lastname: "Β" });
  mock.db.insertRow("parapemtiko", { id: "71111111-0000-0000-0000-000000000001", tenant_id: TENANT_A, student_id: S1, title: "Π1" });
  mock.db.insertRow("doc_opinion", { id: "72222222-0000-0000-0000-000000000001", tenant_id: TENANT_A, student_id: S1, start_date: "2026-01-01" });
  mock.db.insertRow("class_session_students", { tenant_id: TENANT_A, session_id: "73333333-0000-0000-0000-000000000001", student_id: S2, status: "present" });
}

Deno.test("student-bulk-delete", async (t) => {
  await withFunction("student-bulk-delete", async (fn, mock) => {
    seed(mock);

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
      const res = await call(fn.url, { token: TOKEN_A, rawBody: "[[" });
      assertFailEnvelope(res, 400, "INVALID_JSON");
    });

    await t.step("auth runs before validation — no token + empty ids → 401", async () => {
      const res = await call(fn.url, { body: { ids: [] } });
      assertFailEnvelope(res, 401, "INVALID_JWT");
    });

    await t.step("empty ids array → 400 MISSING_FIELDS", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { ids: [] } });
      assertFailEnvelope(res, 400, "MISSING_FIELDS");
    });

    await t.step("ids not an array → 400 MISSING_FIELDS", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { ids: S1 } });
      assertFailEnvelope(res, 400, "MISSING_FIELDS");
    });

    await t.step("no token + valid ids → 401 INVALID_JWT", async () => {
      const res = await call(fn.url, { body: { ids: [S1] } });
      assertFailEnvelope(res, 401, "INVALID_JWT");
      assertCors(res.headers);
    });

    await t.step("token without tenant → 403 NO_TENANT", async () => {
      const res = await call(fn.url, { token: TOKEN_NO_TENANT, body: { ids: [S1] } });
      assertFailEnvelope(res, 403, "NO_TENANT");
    });

    await t.step("one id from another tenant → 404 NOT_FOUND, nothing deleted", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { ids: [S1, S_B] } });
      assertFailEnvelope(res, 404, "NOT_FOUND");
      assertEquals(mock.db.table("students").length, 3, "no student may be deleted on a partial-ownership failure");
      assertEquals(mock.db.table("parapemtiko").length, 1);
    });

    await t.step("unknown id → 404 NOT_FOUND", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { ids: [S1, crypto.randomUUID()] } });
      assertFailEnvelope(res, 404, "NOT_FOUND");
    });

    await t.step("DB ownership-check failure → 400 DB_CHECK_FAILED envelope", async () => {
      mock.db.failNext("students", "select", { code: "XX000", message: "boom" });
      const res = await call(fn.url, { token: TOKEN_A, body: { ids: [S1] } });
      assertFailEnvelope(res, 400, "DB_CHECK_FAILED");
    });

    await t.step("DB delete failure → 400 DB_DELETE_FAILED envelope", async () => {
      mock.db.failNext("parapemtiko", "delete", { code: "XX000", message: "boom" });
      const res = await call(fn.url, { token: TOKEN_A, body: { ids: [S1] } });
      assertFailEnvelope(res, 400, "DB_DELETE_FAILED");
      assert(mock.db.table("students").some((r) => r.user_id === S1), "student must survive when cascade fails");
    });

    await t.step("happy path → 200 {ok,data:{deleted:2}}, children cascaded, tenant B intact", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { ids: [S1, S2] } });
      const data = assertOkEnvelope(res);
      assertEquals(data.deleted, 2);
      assertCors(res.headers);

      const students = mock.db.table("students");
      assertEquals(students.length, 1);
      assertEquals(students[0].user_id, S_B, "tenant B's student must remain");
      assertEquals(mock.db.table("parapemtiko").length, 0);
      assertEquals(mock.db.table("doc_opinion").length, 0);
      assertEquals(mock.db.table("class_session_students").length, 0);
    });
  });
});

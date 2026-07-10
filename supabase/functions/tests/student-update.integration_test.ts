// supabase/functions/tests/student-update.integration_test.ts

import { assertEquals, assert } from "jsr:@std/assert@1";
import {
  withFunction, call, assertCors, assertFailEnvelope, assertOkEnvelope,
  TENANT_A, TENANT_B, TOKEN_A, TOKEN_B, TOKEN_NO_TENANT,
} from "./helpers/harness.ts";

const STUDENT_A = "51111111-0000-0000-0000-000000000001";

function seedStudent(mock: { db: { insertRow(t: string, r: Record<string, unknown>): void } }) {
  mock.db.insertRow("students", {
    user_id: STUDENT_A,
    tenant_id: TENANT_A,
    name: "Αρχικό",
    lastname: "Επώνυμο",
    phone: "2101234567",
    email: "old@example.com",
    active: true,
    updated_at: null,
  });
}

Deno.test("student-update", async (t) => {
  await withFunction("student-update", async (fn, mock) => {
    seedStudent(mock);

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
      const res = await call(fn.url, { token: TOKEN_A, rawBody: "not json at all" });
      assertFailEnvelope(res, 400, "INVALID_JSON");
      assertCors(res.headers);
    });

    await t.step("auth runs before validation — no token + no user_id → 401", async () => {
      const res = await call(fn.url, { body: {} });
      assertFailEnvelope(res, 401, "INVALID_JWT");
    });

    await t.step("no token + valid body → 401 INVALID_JWT", async () => {
      const res = await call(fn.url, { body: { user_id: STUDENT_A, name: "X" } });
      assertFailEnvelope(res, 401, "INVALID_JWT");
      assertCors(res.headers);
    });

    await t.step("token without tenant → 403 NO_TENANT", async () => {
      const res = await call(fn.url, { token: TOKEN_NO_TENANT, body: { user_id: STUDENT_A, name: "X" } });
      assertFailEnvelope(res, 403, "NO_TENANT");
    });

    await t.step("missing user_id → 400 MISSING_FIELDS", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { name: "Χωρίς id" } });
      assertFailEnvelope(res, 400, "MISSING_FIELDS");
    });

    await t.step("happy path → 200 {ok,data:{user_id}}, only sent fields updated", async () => {
      const res = await call(fn.url, {
        token: TOKEN_A,
        body: { user_id: STUDENT_A, name: "Νέο", phone: "2109999999" },
      });
      const data = assertOkEnvelope(res);
      assertEquals(data.user_id, STUDENT_A);
      assertCors(res.headers);

      const row = mock.db.table("students").find((r) => r.user_id === STUDENT_A)!;
      assertEquals(row.name, "Νέο");
      assertEquals(row.phone, "2109999999");
      assertEquals(row.lastname, "Επώνυμο", "fields not in the payload must stay untouched");
      assertEquals(row.email, "old@example.com");
      assert(typeof row.updated_at === "string" && row.updated_at.length > 0, "updated_at must be set");
    });

    await t.step("clearing an optional field: phone:'' → null", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { user_id: STUDENT_A, phone: "" } });
      assertOkEnvelope(res);
      const row = mock.db.table("students").find((r) => r.user_id === STUDENT_A)!;
      assertEquals(row.phone, null);
    });

    await t.step("unknown user_id → 404 NOT_FOUND", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { user_id: crypto.randomUUID(), name: "X" } });
      assertFailEnvelope(res, 404, "NOT_FOUND");
    });

    await t.step("tenant B token on tenant A's student → 404, row unchanged", async () => {
      const res = await call(fn.url, { token: TOKEN_B, body: { user_id: STUDENT_A, name: "ΔΙΑΡΡΟΗ" } });
      assertFailEnvelope(res, 404, "NOT_FOUND");
      const row = mock.db.table("students").find((r) => r.user_id === STUDENT_A)!;
      assertEquals(row.name, "Νέο", "cross-tenant update must not touch the row");
    });

    await t.step("DB update failure → 400 DB_UPDATE_FAILED envelope", async () => {
      mock.db.failNext("students", "update", { code: "XX000", message: "connection reset" });
      const res = await call(fn.url, { token: TOKEN_A, body: { user_id: STUDENT_A, name: "X" } });
      assertFailEnvelope(res, 400, "DB_UPDATE_FAILED");
      assertCors(res.headers);
    });
  });
});

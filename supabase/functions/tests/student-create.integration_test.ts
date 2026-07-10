// supabase/functions/tests/student-create.integration_test.ts
//
// Integration test for student-create: real HTTP against the function running
// as a subprocess, backed by the mock Supabase (see helpers/).
//
// Pins the POST-migration contract (postHandler). Intentional fixes vs the
// legacy implementation (verified as LEGACY steps before the migration):
//   - 405 returned plain text "Method not allowed" → now METHOD_NOT_ALLOWED envelope
//   - invalid JSON / missing fields returned {"error":"..."} bare shapes,
//     unparseable by callFunction → now INVALID_JSON / MISSING_FIELDS envelopes
//   - validation ran BEFORE auth (bad body without token → 400) → now auth
//     runs first, so unauthenticated requests always get 401

import { assertEquals, assert } from "jsr:@std/assert@1";
import {
  withFunction, call, assertCors, assertFailEnvelope, assertOkEnvelope,
  TENANT_A, TENANT_B, TOKEN_A, TOKEN_B, TOKEN_NO_TENANT,
} from "./helpers/harness.ts";

const VALID_BODY = { name: "Νίκος", lastname: "Παπαδόπουλος", email: "nikos@example.com" };

Deno.test("student-create", async (t) => {
  await withFunction("student-create", async (fn, mock) => {
    await t.step("OPTIONS preflight → 204 with CORS headers", async () => {
      const res = await call(fn.url, { method: "OPTIONS" });
      assertEquals(res.status, 204);
      assertCors(res.headers);
      assertEquals(res.rawText, "");
    });

    await t.step("GET → 405 METHOD_NOT_ALLOWED envelope, CORS-wrapped", async () => {
      const res = await call(fn.url, { method: "GET" });
      assertFailEnvelope(res, 405, "METHOD_NOT_ALLOWED");
      assertCors(res.headers);
    });

    await t.step("malformed JSON → 400 INVALID_JSON envelope", async () => {
      const res = await call(fn.url, { token: TOKEN_A, rawBody: "{not json" });
      assertFailEnvelope(res, 400, "INVALID_JSON");
      assertCors(res.headers);
    });

    await t.step("missing name/lastname → 400 MISSING_FIELDS envelope", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { name: "Μόνο όνομα" } });
      assertFailEnvelope(res, 400, "MISSING_FIELDS");
    });

    await t.step("auth runs before validation — no token + bad body → 401", async () => {
      const res = await call(fn.url, { body: {} });
      assertFailEnvelope(res, 401, "INVALID_JWT");
    });

    await t.step("no token + valid body → 401 INVALID_JWT envelope", async () => {
      const res = await call(fn.url, { body: VALID_BODY });
      assertFailEnvelope(res, 401, "INVALID_JWT");
      assertCors(res.headers);
    });

    await t.step("token without tenant → 403 NO_TENANT", async () => {
      const res = await call(fn.url, { token: TOKEN_NO_TENANT, body: VALID_BODY });
      assertFailEnvelope(res, 403, "NO_TENANT");
      assertCors(res.headers);
    });

    await t.step("happy path → 200 {ok:true,data:{id}}, row scoped to tenant A", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: VALID_BODY });
      const data = assertOkEnvelope(res);
      assert(typeof data.id === "string" && data.id.length > 0, "data.id must be a non-empty string");
      assertCors(res.headers);

      const rows = mock.db.table("students");
      assertEquals(rows.length, 1);
      assertEquals(rows[0].user_id, data.id);
      assertEquals(rows[0].tenant_id, TENANT_A);
      assertEquals(rows[0].name, "Νίκος");
      assertEquals(rows[0].lastname, "Παπαδόπουλος");
      assertEquals(rows[0].email, "nikos@example.com");
      assertEquals(rows[0].active, true);
    });

    await t.step("tenant B caller creates row under tenant B, not A", async () => {
      const res = await call(fn.url, { token: TOKEN_B, body: { name: "Β", lastname: "Τενάντ" } });
      const data = assertOkEnvelope(res);
      const row = mock.db.table("students").find((r) => r.user_id === data.id);
      assertEquals(row?.tenant_id, TENANT_B);
    });

    await t.step("DB insert failure → 400 DB_INSERT_FAILED envelope", async () => {
      mock.db.failNext("students", "insert", { code: "23502", message: "null value in column violates not-null constraint" });
      const res = await call(fn.url, { token: TOKEN_A, body: VALID_BODY });
      const err = assertFailEnvelope(res, 400, "DB_INSERT_FAILED");
      assert(String(err.message).includes("not-null"), "error.message should carry the DB message");
      assertCors(res.headers);
    });

    await t.step("profiles lookup failure → 403 NO_TENANT envelope, CORS-wrapped", async () => {
      mock.db.failNext("profiles", "select", { code: "XX000", message: "boom" });
      const res = await call(fn.url, { token: TOKEN_A, body: VALID_BODY });
      assertFailEnvelope(res, 403, "NO_TENANT");
      assertCors(res.headers);
    });
  });
});

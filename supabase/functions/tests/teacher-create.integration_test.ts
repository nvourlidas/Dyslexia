// supabase/functions/tests/teacher-create.integration_test.ts

import { assertEquals, assert } from "jsr:@std/assert@1";
import {
  withFunction, call, assertCors, assertFailEnvelope, assertOkEnvelope,
  TENANT_A, TENANT_B, TOKEN_A, TOKEN_B, TOKEN_NO_TENANT,
} from "./helpers/harness.ts";

const VALID_BODY = { name: "Μαρία", last_name: "Ιωάννου", idikotita: "Λογοθεραπεύτρια" };

Deno.test("teacher-create", async (t) => {
  await withFunction("teacher-create", async (fn, mock) => {
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
      const res = await call(fn.url, { token: TOKEN_A, rawBody: "øå{" });
      assertFailEnvelope(res, 400, "INVALID_JSON");
    });

    await t.step("auth runs before validation — no token + missing fields → 401", async () => {
      const res = await call(fn.url, { body: { name: "Μόνο" } });
      assertFailEnvelope(res, 401, "INVALID_JWT");
    });

    await t.step("missing last_name → 400 MISSING_FIELDS", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { name: "Μαρία" } });
      assertFailEnvelope(res, 400, "MISSING_FIELDS");
    });

    await t.step("no token + valid body → 401 INVALID_JWT", async () => {
      const res = await call(fn.url, { body: VALID_BODY });
      assertFailEnvelope(res, 401, "INVALID_JWT");
      assertCors(res.headers);
    });

    await t.step("token without tenant → 403 NO_TENANT", async () => {
      const res = await call(fn.url, { token: TOKEN_NO_TENANT, body: VALID_BODY });
      assertFailEnvelope(res, 403, "NO_TENANT");
    });

    await t.step("happy path → 200 {ok,data:{id}}, row scoped to tenant A, active defaults true", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: VALID_BODY });
      const data = assertOkEnvelope(res);
      assert(typeof data.id === "string" && data.id.length > 0);
      assertCors(res.headers);

      const row = mock.db.table("teacher").find((r) => r.id === data.id)!;
      assertEquals(row.tenant_id, TENANT_A);
      assertEquals(row.name, "Μαρία");
      assertEquals(row.last_name, "Ιωάννου");
      assertEquals(row.idikotita, "Λογοθεραπεύτρια");
      assertEquals(row.active, true);
      assertEquals(row.phone, null);
    });

    await t.step("tenant B caller creates row under tenant B", async () => {
      const res = await call(fn.url, { token: TOKEN_B, body: { name: "Β", last_name: "Τενάντ" } });
      const data = assertOkEnvelope(res);
      const row = mock.db.table("teacher").find((r) => r.id === data.id)!;
      assertEquals(row.tenant_id, TENANT_B);
    });

    await t.step("DB insert failure → 400 DB_INSERT_FAILED envelope", async () => {
      mock.db.failNext("teacher", "insert", { code: "23505", message: "duplicate key value" });
      const res = await call(fn.url, { token: TOKEN_A, body: VALID_BODY });
      const err = assertFailEnvelope(res, 400, "DB_INSERT_FAILED");
      assertEquals(err.message, "duplicate key value");
    });
  });
});

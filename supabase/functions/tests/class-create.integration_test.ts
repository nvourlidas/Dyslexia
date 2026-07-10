// supabase/functions/tests/class-create.integration_test.ts

import { assertEquals, assert } from "jsr:@std/assert@1";
import {
  withFunction, call, assertCors, assertFailEnvelope, assertOkEnvelope,
  TENANT_A, TENANT_B, TOKEN_A, TOKEN_B, TOKEN_NO_TENANT,
} from "./helpers/harness.ts";

Deno.test("class-create", async (t) => {
  await withFunction("class-create", async (fn, mock) => {
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
      const res = await call(fn.url, { token: TOKEN_A, rawBody: "{]" });
      assertFailEnvelope(res, 400, "INVALID_JSON");
    });

    await t.step("auth runs before validation — no token + no title → 401", async () => {
      const res = await call(fn.url, { body: {} });
      assertFailEnvelope(res, 401, "INVALID_JWT");
    });

    await t.step("blank title → 400 MISSING_FIELDS", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { title: "   " } });
      assertFailEnvelope(res, 400, "MISSING_FIELDS");
    });

    await t.step("no token + valid body → 401 INVALID_JWT", async () => {
      const res = await call(fn.url, { body: { title: "Τμήμα Α" } });
      assertFailEnvelope(res, 401, "INVALID_JWT");
      assertCors(res.headers);
    });

    await t.step("token without tenant → 403 NO_TENANT", async () => {
      const res = await call(fn.url, { token: TOKEN_NO_TENANT, body: { title: "Τμήμα Α" } });
      assertFailEnvelope(res, 403, "NO_TENANT");
    });

    await t.step("happy path → 200 {ok,data:{id}}, row scoped to tenant A", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { title: " Τμήμα Α ", description: "Περιγραφή" } });
      const data = assertOkEnvelope(res);
      assert(typeof data.id === "string" && data.id.length > 0);
      assertCors(res.headers);

      const row = mock.db.table("classes").find((r) => r.id === data.id)!;
      assertEquals(row.tenant_id, TENANT_A);
      assertEquals(row.title, "Τμήμα Α", "title must be trimmed");
      assertEquals(row.description, "Περιγραφή");
      assertEquals(row.active, true);
    });

    await t.step("tenant B caller creates row under tenant B", async () => {
      const res = await call(fn.url, { token: TOKEN_B, body: { title: "Τμήμα Β" } });
      const data = assertOkEnvelope(res);
      assertEquals(mock.db.table("classes").find((r) => r.id === data.id)?.tenant_id, TENANT_B);
    });

    await t.step("DB insert failure → 400 DB_INSERT_FAILED envelope", async () => {
      mock.db.failNext("classes", "insert", { code: "XX000", message: "boom" });
      const res = await call(fn.url, { token: TOKEN_A, body: { title: "Χ" } });
      assertFailEnvelope(res, 400, "DB_INSERT_FAILED");
    });
  });
});

// supabase/functions/tests/class-update.integration_test.ts
//
// Full-update semantics: omitted description resets to null, omitted active
// resets to true. Pinned so the migration can't change it silently.

import { assertEquals } from "jsr:@std/assert@1";
import {
  withFunction, call, assertCors, assertFailEnvelope, assertOkEnvelope,
  TENANT_A, TENANT_B, TOKEN_A, TOKEN_B, TOKEN_NO_TENANT,
} from "./helpers/harness.ts";

const C1 = "81111111-0000-0000-0000-000000000001";

Deno.test("class-update", async (t) => {
  await withFunction("class-update", async (fn, mock) => {
    mock.db.insertRow("classes", {
      id: C1, tenant_id: TENANT_A, title: "Παλιό", description: "Παλιά περιγραφή", active: false,
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
      const res = await call(fn.url, { token: TOKEN_A, rawBody: "nope" });
      assertFailEnvelope(res, 400, "INVALID_JSON");
    });

    await t.step("auth runs before validation — no token + no id/title → 401", async () => {
      const res = await call(fn.url, { body: {} });
      assertFailEnvelope(res, 401, "INVALID_JWT");
    });

    await t.step("missing title → 400 MISSING_FIELDS", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { id: C1 } });
      assertFailEnvelope(res, 400, "MISSING_FIELDS");
    });

    await t.step("no token + valid body → 401 INVALID_JWT", async () => {
      const res = await call(fn.url, { body: { id: C1, title: "Νέο" } });
      assertFailEnvelope(res, 401, "INVALID_JWT");
      assertCors(res.headers);
    });

    await t.step("token without tenant → 403 NO_TENANT", async () => {
      const res = await call(fn.url, { token: TOKEN_NO_TENANT, body: { id: C1, title: "Νέο" } });
      assertFailEnvelope(res, 403, "NO_TENANT");
    });

    await t.step("happy path → 200 {ok,data:{id}}; omitted fields RESET (description→null, active→true)", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { id: C1, title: "Νέο" } });
      const data = assertOkEnvelope(res);
      assertEquals(data.id, C1);
      assertCors(res.headers);

      const row = mock.db.table("classes").find((r) => r.id === C1)!;
      assertEquals(row.title, "Νέο");
      assertEquals(row.description, null, "full-update semantics: omitted description resets");
      assertEquals(row.active, true, "full-update semantics: omitted active resets to true");
    });

    await t.step("unknown id → 404 NOT_FOUND", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { id: crypto.randomUUID(), title: "Χ" } });
      assertFailEnvelope(res, 404, "NOT_FOUND");
    });

    await t.step("tenant B token on tenant A's class → 404, row unchanged", async () => {
      const res = await call(fn.url, { token: TOKEN_B, body: { id: C1, title: "ΔΙΑΡΡΟΗ" } });
      assertFailEnvelope(res, 404, "NOT_FOUND");
      assertEquals(mock.db.table("classes").find((r) => r.id === C1)?.title, "Νέο");
    });

    await t.step("DB update failure → 400 DB_UPDATE_FAILED envelope", async () => {
      mock.db.failNext("classes", "update", { code: "XX000", message: "boom" });
      const res = await call(fn.url, { token: TOKEN_A, body: { id: C1, title: "Χ" } });
      assertFailEnvelope(res, 400, "DB_UPDATE_FAILED");
    });
  });
});

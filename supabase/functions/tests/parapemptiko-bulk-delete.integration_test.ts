// supabase/functions/tests/parapemptiko-bulk-delete.integration_test.ts

import { assertEquals } from "jsr:@std/assert@1";
import {
  withFunction, call, assertCors, assertFailEnvelope, assertOkEnvelope,
  TENANT_A, TENANT_B, TOKEN_A, TOKEN_NO_TENANT,
} from "./helpers/harness.ts";

const P1 = "a8888888-0000-0000-0000-000000000001";
const P2 = "a8888888-0000-0000-0000-000000000002";
const P_B = "a8888888-0000-0000-0000-00000000000b";

Deno.test("parapemptiko-bulk-delete", async (t) => {
  await withFunction("parapemptiko-bulk-delete", async (fn, mock) => {
    mock.db.insertRow("parapemtiko", { id: P1, tenant_id: TENANT_A, title: "Π1" });
    mock.db.insertRow("parapemtiko", { id: P2, tenant_id: TENANT_A, title: "Π2" });
    mock.db.insertRow("parapemtiko", { id: P_B, tenant_id: TENANT_B, title: "Ξ" });

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
      const res = await call(fn.url, { token: TOKEN_A, rawBody: "!" });
      assertFailEnvelope(res, 400, "INVALID_JSON");
    });

    await t.step("auth runs before validation — no token + empty ids → 401", async () => {
      const res = await call(fn.url, { body: { ids: [] } });
      assertFailEnvelope(res, 401, "INVALID_JWT");
    });

    await t.step("empty ids → 400 MISSING_FIELDS", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { ids: [] } });
      assertFailEnvelope(res, 400, "MISSING_FIELDS");
    });

    await t.step("no token + valid ids → 401 INVALID_JWT", async () => {
      const res = await call(fn.url, { body: { ids: [P1] } });
      assertFailEnvelope(res, 401, "INVALID_JWT");
      assertCors(res.headers);
    });

    await t.step("token without tenant → 403 NO_TENANT", async () => {
      const res = await call(fn.url, { token: TOKEN_NO_TENANT, body: { ids: [P1] } });
      assertFailEnvelope(res, 403, "NO_TENANT");
    });

    await t.step("one id from another tenant → 404 NOT_FOUND, nothing deleted", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { ids: [P1, P_B] } });
      assertFailEnvelope(res, 404, "NOT_FOUND");
      assertEquals(mock.db.table("parapemtiko").length, 3);
    });

    await t.step("DB delete failure → 400 DB_DELETE_FAILED", async () => {
      mock.db.failNext("parapemtiko", "delete", { code: "XX000", message: "boom" });
      const res = await call(fn.url, { token: TOKEN_A, body: { ids: [P1] } });
      assertFailEnvelope(res, 400, "DB_DELETE_FAILED");
    });

    await t.step("happy path → 200 {ok,data:{deleted:2}}, tenant B intact", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { ids: [P1, P2] } });
      const data = assertOkEnvelope(res);
      assertEquals(data.deleted, 2);
      assertCors(res.headers);
      assertEquals(mock.db.table("parapemtiko").map((r) => r.id), [P_B]);
    });
  });
});

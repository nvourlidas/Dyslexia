// supabase/functions/tests/doc_opinion-bulk-delete.integration_test.ts

import { assertEquals, assert } from "jsr:@std/assert@1";
import {
  withFunction, call, assertCors, assertFailEnvelope, assertOkEnvelope,
  TENANT_A, TENANT_B, TOKEN_A, TOKEN_NO_TENANT,
} from "./helpers/harness.ts";

const D1 = "a6666666-0000-0000-0000-000000000001";
const D2 = "a6666666-0000-0000-0000-000000000002";
const D_B = "a6666666-0000-0000-0000-00000000000b";
const D_LINKED = "a6666666-0000-0000-0000-000000000003";

Deno.test("doc_opinion-bulk-delete", async (t) => {
  await withFunction("doc_opinion-bulk-delete", async (fn, mock) => {
    mock.db.insertRow("doc_opinion", { id: D1, tenant_id: TENANT_A, start_date: "2026-01-01" });
    mock.db.insertRow("doc_opinion", { id: D2, tenant_id: TENANT_A, start_date: "2026-01-02" });
    mock.db.insertRow("doc_opinion", { id: D_LINKED, tenant_id: TENANT_A, start_date: "2026-01-03" });
    mock.db.insertRow("doc_opinion", { id: D_B, tenant_id: TENANT_B, start_date: "2026-01-04" });
    // a parapemtiko still points at D_LINKED → FK violation on delete
    mock.db.insertRow("parapemtiko", {
      id: "a7777777-0000-0000-0000-000000000001",
      tenant_id: TENANT_A, title: "Π", doc_opinion_id: D_LINKED,
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
      const res = await call(fn.url, { token: TOKEN_A, rawBody: "0x" });
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
      const res = await call(fn.url, { body: { ids: [D1] } });
      assertFailEnvelope(res, 401, "INVALID_JWT");
      assertCors(res.headers);
    });

    await t.step("token without tenant → 403 NO_TENANT", async () => {
      const res = await call(fn.url, { token: TOKEN_NO_TENANT, body: { ids: [D1] } });
      assertFailEnvelope(res, 403, "NO_TENANT");
    });

    await t.step("one id from another tenant → 404 NOT_FOUND, nothing deleted", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { ids: [D1, D_B] } });
      assertFailEnvelope(res, 404, "NOT_FOUND");
      assertEquals(mock.db.table("doc_opinion").length, 4);
    });

    await t.step("FK violation (linked parapemtiko) → 409 CONFLICT envelope", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { ids: [D1, D_LINKED] } });
      assertFailEnvelope(res, 409, "CONFLICT");
      assertEquals(mock.db.table("doc_opinion").length, 4, "no partial delete on FK failure");
    });

    await t.step("DB delete failure → 400 DB_DELETE_FAILED", async () => {
      mock.db.failNext("doc_opinion", "delete", { code: "XX000", message: "boom" });
      const res = await call(fn.url, { token: TOKEN_A, body: { ids: [D1] } });
      assertFailEnvelope(res, 400, "DB_DELETE_FAILED");
    });

    await t.step("happy path → 200 {ok,data:{deleted:2}}, tenant B intact", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { ids: [D1, D2] } });
      const data = assertOkEnvelope(res);
      assertEquals(data.deleted, 2);
      assertCors(res.headers);
      const remaining = mock.db.table("doc_opinion").map((r) => r.id);
      assertEquals(remaining.sort(), [D_LINKED, D_B].sort());
    });
  });
});

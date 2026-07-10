// supabase/functions/tests/teacher-bulk-delete.integration_test.ts

import { assertEquals, assert } from "jsr:@std/assert@1";
import {
  withFunction, call, assertCors, assertFailEnvelope, assertOkEnvelope,
  TENANT_A, TENANT_B, TOKEN_A, TOKEN_NO_TENANT,
} from "./helpers/harness.ts";

const T1 = "64444444-0000-0000-0000-000000000001";
const T2 = "64444444-0000-0000-0000-000000000002";
const T_B = "64444444-0000-0000-0000-00000000000b";
const T_WITH_SESSION = "64444444-0000-0000-0000-000000000003";

Deno.test("teacher-bulk-delete", async (t) => {
  await withFunction("teacher-bulk-delete", async (fn, mock) => {
    mock.db.insertRow("teacher", { id: T1, tenant_id: TENANT_A, name: "Α", last_name: "Ένα" });
    mock.db.insertRow("teacher", { id: T2, tenant_id: TENANT_A, name: "Β", last_name: "Δύο" });
    mock.db.insertRow("teacher", { id: T_WITH_SESSION, tenant_id: TENANT_A, name: "Γ", last_name: "Τρία" });
    mock.db.insertRow("teacher", { id: T_B, tenant_id: TENANT_B, name: "Ξ", last_name: "Ξένος" });
    mock.db.insertRow("class_sessions", {
      id: "65555555-0000-0000-0000-000000000001",
      tenant_id: TENANT_A,
      teacher_id: T_WITH_SESSION,
      starts_at: "2026-07-01T10:00:00Z",
      ends_at: "2026-07-01T11:00:00Z",
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
      const res = await call(fn.url, { token: TOKEN_A, rawBody: "ids=1" });
      assertFailEnvelope(res, 400, "INVALID_JSON");
    });

    await t.step("auth runs before validation — no token + empty ids → 401", async () => {
      const res = await call(fn.url, { body: { ids: [] } });
      assertFailEnvelope(res, 401, "INVALID_JWT");
    });

    await t.step("empty/non-array ids → 400 MISSING_FIELDS", async () => {
      const res1 = await call(fn.url, { token: TOKEN_A, body: { ids: [] } });
      assertFailEnvelope(res1, 400, "MISSING_FIELDS");
      const res2 = await call(fn.url, { token: TOKEN_A, body: { ids: "x" } });
      assertFailEnvelope(res2, 400, "MISSING_FIELDS");
    });

    await t.step("no token + valid ids → 401 INVALID_JWT", async () => {
      const res = await call(fn.url, { body: { ids: [T1] } });
      assertFailEnvelope(res, 401, "INVALID_JWT");
      assertCors(res.headers);
    });

    await t.step("token without tenant → 403 NO_TENANT", async () => {
      const res = await call(fn.url, { token: TOKEN_NO_TENANT, body: { ids: [T1] } });
      assertFailEnvelope(res, 403, "NO_TENANT");
    });

    await t.step("one id from another tenant → 404 NOT_FOUND, nothing deleted", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { ids: [T1, T_B] } });
      assertFailEnvelope(res, 404, "NOT_FOUND");
      assertEquals(mock.db.table("teacher").length, 4);
    });

    await t.step("ownership-check select succeeds but id is missing → 404 NOT_FOUND", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { ids: [T1, T_B] } });
      assertFailEnvelope(res, 404, "NOT_FOUND");
      assertEquals(mock.db.table("teacher").length, 4, "nothing deleted");
    });

    await t.step("ownership-check select itself fails → 500 DB_CHECK_FAILED", async () => {
      mock.db.failNext("teacher", "select", { code: "XX000", message: "boom" });
      const res = await call(fn.url, { token: TOKEN_A, body: { ids: [T1] } });
      assertFailEnvelope(res, 500, "DB_CHECK_FAILED");
      assertEquals(mock.db.table("teacher").length, 4, "nothing deleted");
    });

    await t.step("FK violation (teacher has sessions) → 409 CONFLICT envelope", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { ids: [T1, T_WITH_SESSION] } });
      assertFailEnvelope(res, 409, "CONFLICT");
      assertEquals(mock.db.table("teacher").length, 4, "no partial delete on FK failure");
    });

    await t.step("happy path → 200 {ok,data:{deleted:2}}, tenant B intact", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { ids: [T1, T2] } });
      const data = assertOkEnvelope(res);
      assertEquals(data.deleted, 2);
      assertCors(res.headers);
      const remaining = mock.db.table("teacher").map((r) => r.id);
      assertEquals(remaining.sort(), [T_WITH_SESSION, T_B].sort());
    });
  });
});

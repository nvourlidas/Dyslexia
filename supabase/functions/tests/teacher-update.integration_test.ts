// supabase/functions/tests/teacher-update.integration_test.ts
//
// Unlike student-update, teacher-update is a FULL update: optional fields not
// present in the payload are reset (phone/email/idikotita → null, active → true).
// The tests pin that semantic so a migration can't silently change it.

import { assertEquals } from "jsr:@std/assert@1";
import {
  withFunction, call, assertCors, assertFailEnvelope, assertOkEnvelope,
  TENANT_A, TENANT_B, TOKEN_A, TOKEN_B, TOKEN_NO_TENANT,
} from "./helpers/harness.ts";

const T1 = "61111111-0000-0000-0000-000000000001";

Deno.test("teacher-update", async (t) => {
  await withFunction("teacher-update", async (fn, mock) => {
    mock.db.insertRow("teacher", {
      id: T1, tenant_id: TENANT_A, name: "Παλιό", last_name: "Όνομα",
      phone: "2100000000", email: "t@example.com", idikotita: "Ειδική Παιδαγωγός", active: true,
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
      const res = await call(fn.url, { token: TOKEN_A, rawBody: "" });
      assertFailEnvelope(res, 400, "INVALID_JSON");
    });

    await t.step("auth runs before validation — no token + missing fields → 401", async () => {
      const res = await call(fn.url, { body: { id: T1 } });
      assertFailEnvelope(res, 401, "INVALID_JWT");
    });

    await t.step("missing name/last_name → 400 MISSING_FIELDS", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { id: T1, name: "Χωρίς επώνυμο" } });
      assertFailEnvelope(res, 400, "MISSING_FIELDS");
    });

    await t.step("no token + valid body → 401 INVALID_JWT", async () => {
      const res = await call(fn.url, { body: { id: T1, name: "Α", last_name: "Β" } });
      assertFailEnvelope(res, 401, "INVALID_JWT");
      assertCors(res.headers);
    });

    await t.step("token without tenant → 403 NO_TENANT", async () => {
      const res = await call(fn.url, { token: TOKEN_NO_TENANT, body: { id: T1, name: "Α", last_name: "Β" } });
      assertFailEnvelope(res, 403, "NO_TENANT");
    });

    await t.step("happy path → 200 {ok,data:{id}}; omitted optional fields are RESET", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { id: T1, name: "Νέο", last_name: "Επώνυμο" } });
      const data = assertOkEnvelope(res);
      assertEquals(data.id, T1);
      assertCors(res.headers);

      const row = mock.db.table("teacher").find((r) => r.id === T1)!;
      assertEquals(row.name, "Νέο");
      assertEquals(row.last_name, "Επώνυμο");
      assertEquals(row.phone, null, "full-update semantics: omitted phone resets to null");
      assertEquals(row.email, null);
      assertEquals(row.idikotita, null);
      assertEquals(row.active, true);
    });

    await t.step("unknown id → 404 NOT_FOUND", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { id: crypto.randomUUID(), name: "Α", last_name: "Β" } });
      assertFailEnvelope(res, 404, "NOT_FOUND");
    });

    await t.step("tenant B token on tenant A's teacher → 404, row unchanged", async () => {
      const res = await call(fn.url, { token: TOKEN_B, body: { id: T1, name: "ΔΙΑΡΡΟΗ", last_name: "Χ" } });
      assertFailEnvelope(res, 404, "NOT_FOUND");
      const row = mock.db.table("teacher").find((r) => r.id === T1)!;
      assertEquals(row.name, "Νέο");
    });

    await t.step("DB update failure → 400 DB_UPDATE_FAILED envelope", async () => {
      mock.db.failNext("teacher", "update", { code: "XX000", message: "boom" });
      const res = await call(fn.url, { token: TOKEN_A, body: { id: T1, name: "Α", last_name: "Β" } });
      assertFailEnvelope(res, 400, "DB_UPDATE_FAILED");
    });
  });
});

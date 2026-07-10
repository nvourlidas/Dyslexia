// supabase/functions/tests/doc_opinion-create.integration_test.ts

import { assertEquals, assert } from "jsr:@std/assert@1";
import {
  withFunction, call, assertCors, assertFailEnvelope, assertOkEnvelope,
  TENANT_A, TENANT_B, TOKEN_A, TOKEN_NO_TENANT,
} from "./helpers/harness.ts";

const STUDENT_A = "a1111111-0000-0000-0000-000000000001";
const STUDENT_B = "a1111111-0000-0000-0000-00000000000b";
const PARAP_A = "a2222222-0000-0000-0000-000000000001";
const PARAP_B = "a2222222-0000-0000-0000-00000000000b";

const VALID = { student_id: STUDENT_A, start_date: "2026-07-01" };

Deno.test("doc_opinion-create", async (t) => {
  await withFunction("doc_opinion-create", async (fn, mock) => {
    mock.db.insertRow("students", { user_id: STUDENT_A, tenant_id: TENANT_A, name: "Μ", lastname: "Α" });
    mock.db.insertRow("students", { user_id: STUDENT_B, tenant_id: TENANT_B, name: "Ξ", lastname: "Β" });
    mock.db.insertRow("parapemtiko", { id: PARAP_A, tenant_id: TENANT_A, student_id: STUDENT_A, title: "Π", doc_opinion_id: null });
    mock.db.insertRow("parapemtiko", { id: PARAP_B, tenant_id: TENANT_B, student_id: STUDENT_B, title: "Ξ", doc_opinion_id: null });

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
      const res = await call(fn.url, { token: TOKEN_A, rawBody: "{," });
      assertFailEnvelope(res, 400, "INVALID_JSON");
    });

    await t.step("auth runs before validation — no token + missing fields → 401", async () => {
      const res = await call(fn.url, { body: {} });
      assertFailEnvelope(res, 401, "INVALID_JWT");
    });

    await t.step("missing start_date → 400 MISSING_FIELDS", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { student_id: STUDENT_A } });
      assertFailEnvelope(res, 400, "MISSING_FIELDS");
    });

    await t.step("no token + valid body → 401 INVALID_JWT", async () => {
      const res = await call(fn.url, { body: VALID });
      assertFailEnvelope(res, 401, "INVALID_JWT");
      assertCors(res.headers);
    });

    await t.step("token without tenant → 403 NO_TENANT", async () => {
      const res = await call(fn.url, { token: TOKEN_NO_TENANT, body: VALID });
      assertFailEnvelope(res, 403, "NO_TENANT");
    });

    await t.step("student from another tenant → 404 STUDENT_NOT_FOUND, nothing inserted", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { student_id: STUDENT_B, start_date: "2026-07-01" } });
      assertFailEnvelope(res, 404, "STUDENT_NOT_FOUND");
      assertEquals(mock.db.table("doc_opinion").length, 0);
    });

    await t.step("student check DB failure → 400 STUDENT_CHECK_FAILED", async () => {
      mock.db.failNext("students", "select", { code: "XX000", message: "boom" });
      const res = await call(fn.url, { token: TOKEN_A, body: VALID });
      assertFailEnvelope(res, 400, "STUDENT_CHECK_FAILED");
    });

    await t.step("happy path with parapemptiko links → row + links, tenant-scoped", async () => {
      const res = await call(fn.url, {
        token: TOKEN_A,
        body: { ...VALID, notes: " σημ ", status: "completed", parapemptiko_ids: [PARAP_A] },
      });
      const data = assertOkEnvelope(res);
      assert(typeof data.id === "string" && data.id.length > 0);
      assertCors(res.headers);

      const row = mock.db.table("doc_opinion").find((r) => r.id === data.id)!;
      assertEquals(row.tenant_id, TENANT_A);
      assertEquals(row.student_id, STUDENT_A);
      assertEquals(row.status, "completed");
      assertEquals(row.notes, "σημ");

      assertEquals(mock.db.table("parapemtiko").find((r) => r.id === PARAP_A)?.doc_opinion_id, data.id);
    });

    await t.step("parapemptiko id from another tenant is silently NOT linked (tenant scoping)", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { ...VALID, parapemptiko_ids: [PARAP_B] } });
      assertOkEnvelope(res);
      assertEquals(mock.db.table("parapemtiko").find((r) => r.id === PARAP_B)?.doc_opinion_id, null,
        "tenant B's parapemtiko must not be touched");
    });

    await t.step("invalid status value falls back to pending", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { ...VALID, status: "whatever" } });
      const data = assertOkEnvelope(res);
      assertEquals(mock.db.table("doc_opinion").find((r) => r.id === data.id)?.status, "pending");
    });

    await t.step("DB insert failure → 400 DB_INSERT_FAILED", async () => {
      mock.db.failNext("doc_opinion", "insert", { code: "XX000", message: "boom" });
      const res = await call(fn.url, { token: TOKEN_A, body: VALID });
      assertFailEnvelope(res, 400, "DB_INSERT_FAILED");
    });

    await t.step("link failure → 400 LINK_FAILED (doc_opinion row remains)", async () => {
      const before = mock.db.table("doc_opinion").length;
      mock.db.failNext("parapemtiko", "update", { code: "XX000", message: "boom" });
      const res = await call(fn.url, { token: TOKEN_A, body: { ...VALID, parapemptiko_ids: [PARAP_A] } });
      assertFailEnvelope(res, 400, "LINK_FAILED");
      assertEquals(mock.db.table("doc_opinion").length, before + 1, "known behavior: orphan doc_opinion remains");
    });
  });
});

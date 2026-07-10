// supabase/functions/tests/doc_opinion-update.integration_test.ts

import { assertEquals } from "jsr:@std/assert@1";
import {
  withFunction, call, assertCors, assertFailEnvelope, assertOkEnvelope,
  TENANT_A, TENANT_B, TOKEN_A, TOKEN_B, TOKEN_NO_TENANT,
} from "./helpers/harness.ts";

const DOC_1 = "a3333333-0000-0000-0000-000000000001";
const STUDENT_A = "a4444444-0000-0000-0000-000000000001";
const STUDENT_B = "a4444444-0000-0000-0000-00000000000b";
const PARAP_1 = "a5555555-0000-0000-0000-000000000001";
const PARAP_2 = "a5555555-0000-0000-0000-000000000002";

Deno.test("doc_opinion-update", async (t) => {
  await withFunction("doc_opinion-update", async (fn, mock) => {
    mock.db.insertRow("students", { user_id: STUDENT_A, tenant_id: TENANT_A, name: "Μ", lastname: "Α" });
    mock.db.insertRow("students", { user_id: STUDENT_B, tenant_id: TENANT_B, name: "Ξ", lastname: "Β" });
    mock.db.insertRow("doc_opinion", {
      id: DOC_1, tenant_id: TENANT_A, student_id: STUDENT_A,
      start_date: "2026-06-01", end_date: null, notes: "παλιές", status: "pending",
    });
    mock.db.insertRow("parapemtiko", { id: PARAP_1, tenant_id: TENANT_A, student_id: STUDENT_A, title: "Π1", doc_opinion_id: DOC_1 });
    mock.db.insertRow("parapemtiko", { id: PARAP_2, tenant_id: TENANT_A, student_id: STUDENT_A, title: "Π2", doc_opinion_id: null });

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
      const res = await call(fn.url, { token: TOKEN_A, rawBody: "]" });
      assertFailEnvelope(res, 400, "INVALID_JSON");
    });

    await t.step("auth runs before validation — no token + no id → 401", async () => {
      const res = await call(fn.url, { body: {} });
      assertFailEnvelope(res, 401, "INVALID_JWT");
    });

    await t.step("missing id → 400 MISSING_ID", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { notes: "x" } });
      assertFailEnvelope(res, 400, "MISSING_ID");
    });

    await t.step("no token + valid body → 401 INVALID_JWT", async () => {
      const res = await call(fn.url, { body: { id: DOC_1 } });
      assertFailEnvelope(res, 401, "INVALID_JWT");
      assertCors(res.headers);
    });

    await t.step("token without tenant → 403 NO_TENANT", async () => {
      const res = await call(fn.url, { token: TOKEN_NO_TENANT, body: { id: DOC_1 } });
      assertFailEnvelope(res, 403, "NO_TENANT");
    });

    await t.step("student_id from another tenant → 404 NOT_FOUND, row unchanged", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { id: DOC_1, student_id: STUDENT_B } });
      assertFailEnvelope(res, 404, "NOT_FOUND");
      assertEquals(mock.db.table("doc_opinion").find((r) => r.id === DOC_1)?.student_id, STUDENT_A);
    });

    await t.step("happy path partial update → 200 {ok,data:{id}}", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { id: DOC_1, notes: " νέες ", status: "completed" } });
      const data = assertOkEnvelope(res);
      assertEquals(data.id, DOC_1);
      assertCors(res.headers);

      const row = mock.db.table("doc_opinion").find((r) => r.id === DOC_1)!;
      assertEquals(row.notes, "νέες");
      assertEquals(row.status, "completed");
      assertEquals(row.start_date, "2026-06-01", "fields not sent stay untouched");
    });

    await t.step("parapemptiko_ids sync: unlinks old, links new", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { id: DOC_1, parapemptiko_ids: [PARAP_2] } });
      assertEquals(res.status, 200);
      assertEquals(mock.db.table("parapemtiko").find((r) => r.id === PARAP_1)?.doc_opinion_id, null, "old link removed");
      assertEquals(mock.db.table("parapemtiko").find((r) => r.id === PARAP_2)?.doc_opinion_id, DOC_1, "new link added");
    });

    await t.step("parapemptiko_ids: [] unlinks everything", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { id: DOC_1, parapemptiko_ids: [] } });
      assertEquals(res.status, 200);
      assertEquals(mock.db.table("parapemtiko").filter((r) => r.doc_opinion_id === DOC_1).length, 0);
    });

    await t.step("unknown id → 404 NOT_FOUND", async () => {
      const res = await call(fn.url, { token: TOKEN_A, body: { id: crypto.randomUUID(), notes: "x" } });
      assertFailEnvelope(res, 404, "NOT_FOUND");
    });

    await t.step("tenant B token on tenant A's doc_opinion → 404, row unchanged", async () => {
      const res = await call(fn.url, { token: TOKEN_B, body: { id: DOC_1, notes: "ΔΙΑΡΡΟΗ" } });
      assertFailEnvelope(res, 404, "NOT_FOUND");
      assertEquals(mock.db.table("doc_opinion").find((r) => r.id === DOC_1)?.notes, "νέες");
    });

    await t.step("DB update failure → 400 DB_UPDATE_FAILED", async () => {
      mock.db.failNext("doc_opinion", "update", { code: "XX000", message: "boom" });
      const res = await call(fn.url, { token: TOKEN_A, body: { id: DOC_1, notes: "x" } });
      assertFailEnvelope(res, 400, "DB_UPDATE_FAILED");
    });

    await t.step("unlink failure → 400 UNLINK_FAILED", async () => {
      mock.db.failNext("parapemtiko", "update", { code: "XX000", message: "boom" });
      const res = await call(fn.url, { token: TOKEN_A, body: { id: DOC_1, parapemptiko_ids: [PARAP_1] } });
      assertFailEnvelope(res, 400, "UNLINK_FAILED");
    });
  });
});

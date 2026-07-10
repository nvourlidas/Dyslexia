// supabase/functions/_shared/tenancy.ts
// Shared guard for foreign keys coming from the client: verifies that every
// id actually exists in `table` and belongs to `tenantId` before it gets used
// in an insert/update. Prevents cross-tenant references (e.g. tenant A
// attaching tenant B's teacher_id to a session).

export class TenancyError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 404) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/**
 * Throws TenancyError("DB_CHECK_FAILED", ..., 500) if the ownership select
 * itself fails, or TenancyError("NOT_FOUND", ..., 404) if any id in `ids` is
 * missing from `table` for the given `tenantId`. Falsy ids are ignored
 * (nothing to check). `idColumn` defaults to "id" — pass "user_id" for the
 * `students` table.
 */
export async function assertOwnedIds(
  admin: any,
  table: string,
  ids: Array<string | null | undefined>,
  tenantId: string,
  idColumn = "id",
): Promise<void> {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean).map(String)));
  if (uniqueIds.length === 0) return;

  const { data, error } = await admin
    .from(table)
    .select(idColumn)
    .eq("tenant_id", tenantId)
    .in(idColumn, uniqueIds);

  if (error) {
    throw new TenancyError("DB_CHECK_FAILED", `Αποτυχία επαλήθευσης "${table}": ${error.message}`, 500);
  }

  const found = new Set((data ?? []).map((row: Record<string, any>) => String(row[idColumn])));
  const missing = uniqueIds.filter((id) => !found.has(id));

  if (missing.length > 0) {
    throw new TenancyError(
      "NOT_FOUND",
      `${table}: δεν βρέθηκαν ή δεν ανήκουν στο tenant σου (${missing.join(", ")}).`,
    );
  }
}

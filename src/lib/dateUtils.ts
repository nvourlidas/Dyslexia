/** Converts YYYY-MM-DD or ISO datetime string to DD/MM/YYYY. Returns "—" for null/empty. */
export function fmtDate(value: string | null | undefined): string {
  if (!value) return "—"
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  return "—"
}

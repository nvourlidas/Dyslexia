import React from "react";
import type { LucideIcon } from "lucide-react";
import { Eye, Pencil, Loader2, Trash2 } from "lucide-react";
import { callFunction } from "@/lib/api";
import type { TeacherRow, TeacherColumnKey } from "@/types/teacher";

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 font-semibold ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}

function IconButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/10 hover:bg-secondary/20"
      aria-label={label}
      title={label}
    >
      <Icon className="h-4 w-4" />
      <span className="sr-only">{label}</span>
    </button>
  );
}

function DeleteButton({
  id,
  onDeleted,
}: {
  id: string;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = React.useState(false);

  const onClick = async () => {
    if (!confirm("Διαγραφή αυτού του εκπαιδευτικού; Αυτή η ενέργεια δεν μπορεί να αναιρεθεί."))
      return;

    setBusy(true);
    try {
      await callFunction("teacher-delete", { id });
      onDeleted();
    } catch (e: any) {
      alert(e?.message ?? "Σφάλμα διαγραφής.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-400/60 text-red-400 hover:bg-red-500/10 disabled:opacity-50 ml-1"
      onClick={onClick}
      disabled={busy}
      aria-label="Διαγραφή εκπαιδευτικού"
      title="Διαγραφή εκπαιδευτικού"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      <span className="sr-only">Διαγραφή</span>
    </button>
  );
}

export default function TeachersTable({
  tenantId,
  loading,
  filteredLength,
  paginated,
  desktopColCount,
  isColVisible,
  selectedIds,
  toggleSelect,
  clearSelection,
  allPageSelected,
  toggleSelectPage,
  startIdx,
  endIdx,
  page,
  pageCount,
  pageSize,
  setPage,
  setPageSize,
  onEdit,
  onDeleted,
  formatDateDMY,
}: {
  tenantId: string | null;
  loading: boolean;
  filteredLength: number;
  paginated: TeacherRow[];
  desktopColCount: number;
  isColVisible: (k: TeacherColumnKey) => boolean;
  selectedIds: string[];
  toggleSelect: (id: string) => void;
  clearSelection: () => void;
  allPageSelected: boolean;
  toggleSelectPage: () => void;
  startIdx: number;
  endIdx: number;
  page: number;
  pageCount: number;
  pageSize: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  setPageSize: React.Dispatch<React.SetStateAction<number>>;
  onEdit: (r: TeacherRow) => void;
  onDeleted: () => void;
  formatDateDMY: (value: string | null | undefined) => string;
}) {
  return (
    <div className="w-full rounded-md border border-border/15 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[480px]">
          <thead className="bg-panel/60">
            <tr className="text-left">
              <Th className="w-10">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={allPageSelected}
                  onChange={toggleSelectPage}
                />
              </Th>
              <Th>Ονοματεπώνυμο</Th>
              {isColVisible("phone") && <Th>Τηλέφωνο</Th>}
              {isColVisible("email") && <Th>Email</Th>}
              {isColVisible("idikotita") && <Th>Ιδικότητα</Th>}
              {isColVisible("active") && <Th>Κατάσταση</Th>}
              {isColVisible("created_at") && <Th>Ημ. Δημιουργίας</Th>}
              <Th className="text-right pr-3">Ενέργειες</Th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="px-3 py-4 opacity-60" colSpan={desktopColCount}>Loading…</td>
              </tr>
            )}
            {!loading && filteredLength === 0 && (
              <tr>
                <td className="px-3 py-4 opacity-60" colSpan={desktopColCount}>Κανένας εκπαιδευτικός</td>
              </tr>
            )}
            {!loading && filteredLength > 0 && paginated.map((t) => {
              const fullName = `${t.last_name ?? ""} ${t.name ?? ""}`.trim() || "—";
              return (
                <tr key={t.id} className="border-t border-border/5 hover:bg-panel/10">
                  <Td>
                    <input type="checkbox" className="accent-primary" checked={selectedIds.includes(t.id)} onChange={() => toggleSelect(t.id)} />
                  </Td>
                  <Td>
                    <div className="font-medium whitespace-nowrap">{fullName}</div>
                    {t.idikotita && <div className="text-xs text-muted">{t.idikotita}</div>}
                  </Td>
                  {isColVisible("phone") && <Td className="whitespace-nowrap">{t.phone ?? "—"}</Td>}
                  {isColVisible("email") && <Td>{t.email ?? "—"}</Td>}
                  {isColVisible("idikotita") && <Td>{t.idikotita ?? "—"}</Td>}
                  {isColVisible("active") && (
                    <Td>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${t.active ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                        {t.active ? "Ενεργός" : "Ανενεργός"}
                      </span>
                    </Td>
                  )}
                  {isColVisible("created_at") && <Td className="whitespace-nowrap">{formatDateDMY(t.created_at)}</Td>}
                  <Td className="text-right space-x-1 pr-3 whitespace-nowrap">
                    <IconButton icon={Eye} label="Λεπτομέρειες" onClick={() => onEdit(t)} />
                    <IconButton icon={Pencil} label="Επεξεργασία" onClick={() => onEdit(t)} />
                    <DeleteButton id={t.id} onDeleted={onDeleted} />
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!loading && filteredLength > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs text-muted border-t border-border/10">
          <div>{startIdx}–{endIdx} από {filteredLength}</div>
          <div className="flex items-center gap-2 flex-wrap">
            <select className="bg-transparent border border-border/10 rounded px-1 py-0.5" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
              <option value={10}>10 / σελ.</option>
              <option value={25}>25 / σελ.</option>
              <option value={50}>50 / σελ.</option>
            </select>
            <button className="px-2 py-1 rounded border border-border/10 disabled:opacity-40" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
            <span>{page} / {pageCount}</span>
            <button className="px-2 py-1 rounded border border-border/10 disabled:opacity-40" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page === pageCount}>›</button>
          </div>
        </div>
      )}
    </div>
  );
}

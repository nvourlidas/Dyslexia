import React from "react";
import type { LucideIcon } from "lucide-react";
import { Eye, Pencil } from "lucide-react";
import { Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

import type { StudentRow, ColumnKey } from "@/types/student";




function Th({ children, className = "" }: any) {
  return <th className={`px-3 py-2 font-semibold ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: any) {
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
  tenantId,
  id,
  onDeleted,
}: {
  tenantId: string | null;
  id: string;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = React.useState(false);

  const onClick = async () => {
    if (!tenantId) return;

    if (
      !confirm("Διαγραφή αυτού του μαθητή; Αυτή η ενέργεια δεν μπορεί να αναιρεθεί.")
    )
      return;

    setBusy(true);
    const { error } = await supabase
      .from("students")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("user_id", id);

    setBusy(false);

    if (error) {
      alert(error.message);
      return;
    }
    onDeleted();
  };

  return (
    <button
      type="button"
      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-400/60 text-red-400 hover:bg-red-500/10 disabled:opacity-50 ml-1"
      onClick={onClick}
      disabled={busy}
      aria-label="Διαγραφή μαθητή"
      title="Διαγραφή μαθητή"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      <span className="sr-only">Διαγραφή</span>
    </button>
  );
}

export default function StudentsTable({
  tenantId,
  loading,
  filteredLength,
  paginated,
  desktopColCount,

  // columns
  isColVisible,

  // selection
  selectedIds,
  toggleSelect,
  allPageSelected,
  toggleSelectPage,

  // pagination UI
  startIdx,
  endIdx,
  page,
  pageCount,
  pageSize,
  setPage,
  setPageSize,

  // actions
  onEdit,
  onDeleted,
  formatDateDMY,
}: {
  tenantId: string | null;
  loading: boolean;
  filteredLength: number;
  paginated: StudentRow[];
  desktopColCount: number;

  isColVisible: (k: ColumnKey) => boolean;

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

  onEdit: (s: StudentRow) => void;
  onDeleted: () => void;

  formatDateDMY: (value: string | null | undefined) => string;
}) {
  return (
    <div className="w-full rounded-md border border-border/15 overflow-hidden">
      {/* DESKTOP */}
      <div className="hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
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
                <Th>Τηλέφωνο</Th>

                {isColVisible("email") && <Th>Email</Th>}
                {isColVisible("birthdate") && <Th>Ημ. Γέννησης</Th>}
                {isColVisible("city") && <Th>Πόλη</Th>}
                {isColVisible("address") && <Th>Διεύθυνση</Th>}
                {isColVisible("amka") && <Th>ΑΜΚΑ</Th>}
                {isColVisible("gender") && <Th>Φύλο</Th>}
                {isColVisible("parent_name") && <Th>Γονέας</Th>}
                {isColVisible("parent_phone1") && <Th>Τηλ. Γονέα 1</Th>}
                {isColVisible("parent_phone2") && <Th>Τηλ. Γονέα 2</Th>}
                {isColVisible("doctor_visit") && <Th>Επίσκεψη Γιατρού</Th>}
                {isColVisible("doctor_name") && <Th>Γιατρός</Th>}
                {isColVisible("created_at") && <Th>Ημ. Δημιουργίας</Th>}

                <Th className="text-right pr-3">Ενέργειες</Th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td className="px-3 py-4 opacity-60" colSpan={desktopColCount}>
                    Loading…
                  </td>
                </tr>
              )}

              {!loading && filteredLength === 0 && (
                <tr>
                  <td className="px-3 py-4 opacity-60" colSpan={desktopColCount}>
                    Κανένας μαθητής
                  </td>
                </tr>
              )}

              {!loading &&
                filteredLength > 0 &&
                paginated.map((s) => {
                  const fullName = `${s.lastname ?? ""} ${s.name ?? ""}`.trim() || "—";

                  return (
                    <tr
                      key={s.user_id}
                      className="border-t border-border/5 hover:bg-panel/10"
                    >
                      <Td>
                        <input
                          type="checkbox"
                          className="accent-primary"
                          checked={selectedIds.includes(s.user_id)}
                          onChange={() => toggleSelect(s.user_id)}
                        />
                      </Td>

                      <Td>
                        <div className="font-medium">{fullName}</div>
                        <div className="text-xs text-muted">
                          {s.active ? "Active" : "Inactive"}
                        </div>
                      </Td>

                      <Td>{s.phone ?? "—"}</Td>

                      {isColVisible("email") && <Td>{s.email ?? "—"}</Td>}
                      {isColVisible("birthdate") && <Td>{formatDateDMY(s.birthdate)}</Td>}
                      {isColVisible("city") && <Td>{s.city ?? "—"}</Td>}
                      {isColVisible("address") && <Td>{s.address ?? "—"}</Td>}
                      {isColVisible("amka") && <Td>{s.amka ?? "—"}</Td>}
                      {isColVisible("gender") && <Td>{s.gender ?? "—"}</Td>}
                      {isColVisible("parent_name") && <Td>{s.parent_name ?? "—"}</Td>}
                      {isColVisible("parent_phone1") && <Td>{s.parent_phone1 ?? "—"}</Td>}
                      {isColVisible("parent_phone2") && <Td>{s.parent_phone2 ?? "—"}</Td>}
                      {isColVisible("doctor_visit") && (
                        <Td>{s.doctor_visit ? "Ναι" : "Όχι"}</Td>
                      )}
                      {isColVisible("doctor_name") && <Td>{s.doctor_name ?? "—"}</Td>}
                      {isColVisible("created_at") && <Td>{formatDateDMY(s.created_at)}</Td>}

                      <Td className="text-right space-x-1 pr-3">
                        <IconButton icon={Eye} label="Λεπτομέρειες" onClick={() => onEdit(s)} />
                        <IconButton icon={Pencil} label="Επεξεργασία" onClick={() => onEdit(s)} />
                        <DeleteButton tenantId={tenantId} id={s.user_id} onDeleted={onDeleted} />
                      </Td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MOBILE */}
      <div className="md:hidden">
        {loading && <div className="px-3 py-4 text-sm opacity-60">Loading…</div>}

        {!loading && filteredLength === 0 && (
          <div className="px-3 py-4 text-sm opacity-60">Κανένας μαθητής</div>
        )}

        {!loading &&
          filteredLength > 0 &&
          paginated.map((s) => {
            const fullName = `${s.lastname ?? ""} ${s.name ?? ""}`.trim() || "—";

            return (
              <div key={s.user_id} className="border-t border-border/10 bg-panel/5 px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1 accent-primary"
                      checked={selectedIds.includes(s.user_id)}
                      onChange={() => toggleSelect(s.user_id)}
                    />
                    <div>
                      <div className="font-medium text-sm">{fullName}</div>
                      <div className="text-xs text-muted">{s.phone ?? "—"}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <IconButton icon={Eye} label="Λεπτομέρειες" onClick={() => onEdit(s)} />
                    <IconButton icon={Pencil} label="Επεξεργασία" onClick={() => onEdit(s)} />
                    <DeleteButton tenantId={tenantId} id={s.user_id} onDeleted={onDeleted} />
                  </div>
                </div>

                <div className="mt-2 space-y-1 text-xs">
                  {isColVisible("email") && (
                    <div>
                      <span className="opacity-70">Email: </span>
                      {s.email ?? "—"}
                    </div>
                  )}
                  {isColVisible("amka") && (
                    <div>
                      <span className="opacity-70">ΑΜΚΑ: </span>
                      {s.amka ?? "—"}
                    </div>
                  )}
                  {isColVisible("city") && (
                    <div>
                      <span className="opacity-70">Πόλη: </span>
                      {s.city ?? "—"}
                    </div>
                  )}
                  {isColVisible("birthdate") && (
                    <div>
                      <span className="opacity-70">Ημ. Γέννησης: </span>
                      {formatDateDMY(s.birthdate)}
                    </div>
                  )}
                  {isColVisible("created_at") && (
                    <div className="opacity-70">Δημιουργήθηκε: {formatDateDMY(s.created_at)}</div>
                  )}
                </div>
              </div>
            );
          })}
      </div>

      {/* Pagination footer */}
      {!loading && filteredLength > 0 && (
        <div className="flex items-center justify-between px-3 py-2 text-xs text-muted border-t border-border/10">
          <div>
            Εμφάνιση <span className="font-semibold">{startIdx}</span>
            {filteredLength > 0 && (
              <>
                –<span className="font-semibold">{endIdx}</span>
              </>
            )}{" "}
            από <span className="font-semibold">{filteredLength}</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span>Γραμμές ανά σελίδα:</span>
              <select
                className="bg-transparent border border-border/10 rounded px-1 py-0.5"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="px-2 py-1 rounded border border-border/10 disabled:opacity-40"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Προηγ.
              </button>
              <span>
                Σελίδα <span className="font-semibold">{page}</span> από{" "}
                <span className="font-semibold">{pageCount}</span>
              </span>
              <button
                className="px-2 py-1 rounded border border-border/10 disabled:opacity-40"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page === pageCount}
              >
                Επόμενο
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
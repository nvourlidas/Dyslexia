// src/components/doc-opinion/DocOpinionTable.tsx

export type DocOpinionRow = {
  id: string;
  tenant_id: string;
  student_id: string;
  start_date: string;
  end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;

  student?: {
    name: string | null;
    lastname: string | null;
  } | null;
};

export type DocOpinionColKey = "start_date" | "end_date" | "notes" | "created_at";

type Props = {
  rows: DocOpinionRow[];
  loading: boolean;
  onEdit: (row: DocOpinionRow) => void;
  onDelete: (row: DocOpinionRow) => void;
  isColVisible?: (key: DocOpinionColKey) => boolean;
  selectedIds: string[];
  toggleSelect: (id: string) => void;
  allPageSelected: boolean;
  toggleSelectPage: () => void;
};

export default function DocOpinionTable({
  rows,
  loading,
  onEdit,
  onDelete,
  isColVisible,
  selectedIds,
  toggleSelect,
  allPageSelected,
  toggleSelectPage,
}: Props) {
  const show = (k: DocOpinionColKey) => !isColVisible || isColVisible(k);

  if (loading) {
    return (
      <div className="mt-4 rounded-xl border border-border bg-panel2 p-4 text-sm text-muted">
        Φόρτωση...
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="mt-4 rounded-xl border border-border bg-panel2 p-4 text-sm text-muted">
        Δεν βρέθηκαν γνωματεύσεις.
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-panel2">
      <div className="overflow-auto">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-panel">
            <tr className="text-muted">
              <th className="px-3 py-3 w-10">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={allPageSelected}
                  onChange={toggleSelectPage}
                />
              </th>
              <th className="px-3 py-3">Μαθητής</th>
              {show("start_date") && <th className="px-3 py-3">Έναρξη</th>}
              {show("end_date") && <th className="px-3 py-3">Λήξη</th>}
              {show("notes") && <th className="px-3 py-3">Σημειώσεις</th>}
              {show("created_at") && <th className="px-3 py-3">Ημ. Δημιουργίας</th>}
              <th className="px-3 py-3 text-right">Ενέργειες</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => {
              const fullName =
                r.student?.lastname || r.student?.name
                  ? `${r.student?.lastname ?? ""} ${r.student?.name ?? ""}`.trim()
                  : r.student_id;

              return (
                <tr
                  key={r.id}
                  className={`border-t border-border/60 ${selectedIds.includes(r.id) ? "bg-primary/5" : ""}`}
                >
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      className="accent-primary"
                      checked={selectedIds.includes(r.id)}
                      onChange={() => toggleSelect(r.id)}
                    />
                  </td>
                  <td className="px-3 py-3 font-medium">{fullName}</td>
                  {show("start_date") && <td className="px-3 py-3">{r.start_date}</td>}
                  {show("end_date") && <td className="px-3 py-3">{r.end_date ?? "-"}</td>}
                  {show("notes") && <td className="px-3 py-3">{r.notes ? r.notes.slice(0, 60) : "-"}</td>}
                  {show("created_at") && <td className="px-3 py-3">{r.created_at?.slice(0, 10) ?? "-"}</td>}
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-2">
                      <button className="btn" onClick={() => onEdit(r)}>
                        Επεξεργασία
                      </button>
                      <button className="btn" onClick={() => onDelete(r)}>
                        Διαγραφή
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

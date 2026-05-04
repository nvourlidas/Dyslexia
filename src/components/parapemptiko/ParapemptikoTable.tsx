// src/components/parapemptika/ParapemptikaTable.tsx

export type ParapemtikoRow = {
  id: string;
  tenant_id: string;
  title: string;
  doc_opinion_id: string;
  code: string | null;
  code_diagnosis: string | null;
  start_date: string;
  end_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ParapemptikoColKey =
  | "code"
  | "code_diagnosis"
  | "start_date"
  | "end_date"
  | "status"
  | "notes"
  | "created_at";

type Props = {
  rows: ParapemtikoRow[];
  loading: boolean;
  onEdit: (row: ParapemtikoRow) => void;
  onDelete: (row: ParapemtikoRow) => void;
  isColVisible?: (key: ParapemptikoColKey) => boolean;
  selectedIds: string[];
  toggleSelect: (id: string) => void;
  allPageSelected: boolean;
  toggleSelectPage: () => void;
};

export default function ParapemptikοTable({
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
  const show = (k: ParapemptikoColKey) => !isColVisible || isColVisible(k);

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
        Δεν βρέθηκαν παραπεμπτικά.
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
              <th className="px-3 py-3">Τίτλος</th>
              {show("code") && <th className="px-3 py-3">Κωδικός</th>}
              {show("code_diagnosis") && <th className="px-3 py-3">Κωδ. Διάγνωσης</th>}
              {show("start_date") && <th className="px-3 py-3">Έναρξη</th>}
              {show("end_date") && <th className="px-3 py-3">Λήξη</th>}
              {show("status") && <th className="px-3 py-3">Status</th>}
              {show("notes") && <th className="px-3 py-3">Σημειώσεις</th>}
              {show("created_at") && <th className="px-3 py-3">Ημ. Δημιουργίας</th>}
              <th className="px-3 py-3 text-right">Ενέργειες</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => (
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
                <td className="px-3 py-3 font-medium">{r.title}</td>
                {show("code") && <td className="px-3 py-3">{r.code ?? "-"}</td>}
                {show("code_diagnosis") && <td className="px-3 py-3">{r.code_diagnosis ?? "-"}</td>}
                {show("start_date") && <td className="px-3 py-3">{r.start_date}</td>}
                {show("end_date") && <td className="px-3 py-3">{r.end_date ?? "-"}</td>}
                {show("status") && <td className="px-3 py-3">{r.status}</td>}
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

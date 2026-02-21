// src/components/doc-opinion/DocOpinionTable.tsx
import React from "react";

export type DocOpinionRow = {
  id: string;
  tenant_id: string;
  student_id: string;
  start_date: string;
  end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;

  // ✅ add joined student
  student?: {
    name: string | null;
    lastname: string | null;
  } | null;
};

type Props = {
  rows: DocOpinionRow[];
  loading: boolean;
  onEdit: (row: DocOpinionRow) => void;
  onDelete: (row: DocOpinionRow) => void;
};

export default function DocOpinionTable({ rows, loading, onEdit, onDelete }: Props) {
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
              <th className="px-3 py-3">Μαθητής</th>
              <th className="px-3 py-3">Έναρξη</th>
              <th className="px-3 py-3">Λήξη</th>
              <th className="px-3 py-3">Σημειώσεις</th>
              <th className="px-3 py-3 text-right">Ενέργειες</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => {
              const fullName =
                r.student?.lastname || r.student?.name
                  ? `${r.student?.lastname ?? ""} ${r.student?.name ?? ""}`.trim()
                  : r.student_id; // fallback

              return (
                <tr key={r.id} className="border-t border-border/60">
                  <td className="px-3 py-3 font-medium">{fullName}</td>
                  <td className="px-3 py-3">{r.start_date}</td>
                  <td className="px-3 py-3">{r.end_date ?? "-"}</td>
                  <td className="px-3 py-3">{r.notes ? r.notes.slice(0, 60) : "-"}</td>
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
// src/components/parapemptika/ParapemptikaTable.tsx
import React from "react";

export type ParapemtikoRow = {
  id: string;
  tenant_id: string;
  title: string;
  doc_opinion_id: string;
  code: string | null;
  code_diagnosis: string | null;
  start_date: string; // yyyy-mm-dd
  end_date: string | null; // yyyy-mm-dd
  status: string; // parapemtiko_status (enum)
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type Props = {
  rows: ParapemtikoRow[];
  loading: boolean;
  onEdit: (row: ParapemtikoRow) => void;
  onDelete: (row: ParapemtikoRow) => void;
};

export default function ParapemptikοTable({ rows, loading, onEdit, onDelete }: Props) {
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
              <th className="px-3 py-3">Τίτλος</th>
              <th className="px-3 py-3">Κωδικός</th>
              <th className="px-3 py-3">Κωδ. Διάγνωσης</th>
              <th className="px-3 py-3">Έναρξη</th>
              <th className="px-3 py-3">Λήξη</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3 text-right">Ενέργειες</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border/60">
                <td className="px-3 py-3 font-medium">{r.title}</td>
                <td className="px-3 py-3">{r.code ?? "-"}</td>
                <td className="px-3 py-3">{r.code_diagnosis ?? "-"}</td>
                <td className="px-3 py-3">{r.start_date}</td>
                <td className="px-3 py-3">{r.end_date ?? "-"}</td>
                <td className="px-3 py-3">{r.status}</td>
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
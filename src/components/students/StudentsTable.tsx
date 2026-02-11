import React from 'react'

type Gender = 'male' | 'female' | 'other' | 'unknown'

export type StudentRow = {
  user_id: string
  tenant_id: string | null

  name: string
  lastname: string
  amka: string | null
  gender: Gender
  birthdate: string | null

  address: string | null
  city: string | null
  phone: string | null
  email: string | null

  parent_name: string | null
  parent_phone1: string | null
  parent_phone2: string | null

  active: boolean
  doctor_visit: boolean
  doctor_name: string | null

  created_at: string
  updated_at: string
}

export default function StudentsTable({
  rows,
  loading,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  rows: StudentRow[]
  loading: boolean
  onEdit: (row: StudentRow) => void
  onDelete: (row: StudentRow) => void
  onToggleActive: (row: StudentRow, next: boolean) => void
}) {
  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="bg-panel2 text-muted">
          <tr className="text-left">
            <th className="px-3 py-3">Ονοματεπώνυμο</th>
            <th className="px-3 py-3">Τηλέφωνο</th>
            <th className="px-3 py-3">Email</th>
            <th className="px-3 py-3">Πόλη</th>
            <th className="px-3 py-3">Γονέας</th>
            <th className="px-3 py-3">Active</th>
            <th className="px-3 py-3 text-right">Ενέργειες</th>
          </tr>
        </thead>

        <tbody>
          {loading ? (
            <tr>
              <td className="px-3 py-6 text-muted" colSpan={7}>
                Φόρτωση…
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td className="px-3 py-6 text-muted" colSpan={7}>
                Δεν βρέθηκαν μαθητές.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.user_id} className="border-t border-border/60">
                <td className="px-3 py-3">
                  <div className="font-medium text-text">
                    {r.lastname} {r.name}
                  </div>
                  <div className="text-xs text-muted">
                    ΑΜΚΑ: {r.amka ?? '—'} • Φύλο: {r.gender ?? 'unknown'}
                  </div>
                </td>
                <td className="px-3 py-3">{r.phone ?? '—'}</td>
                <td className="px-3 py-3">{r.email ?? '—'}</td>
                <td className="px-3 py-3">{r.city ?? '—'}</td>
                <td className="px-3 py-3">
                  <div className="text-text">{r.parent_name ?? '—'}</div>
                  <div className="text-xs text-muted">
                    {r.parent_phone1 ?? '—'}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!r.active}
                      onChange={(e) => onToggleActive(r, e.target.checked)}
                    />
                    <span className="text-xs text-muted">
                      {r.active ? 'Active' : 'Inactive'}
                    </span>
                  </label>
                </td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-2">
                    <button className="btn" onClick={() => onEdit(r)}>
                      Edit
                    </button>
                    <button className="btn btn-danger" onClick={() => onDelete(r)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

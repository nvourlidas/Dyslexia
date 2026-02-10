import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/auth/AuthProvider'
import Modal from '@/components/students/Modal'
import ConfirmModal from '@/components/students/ConfirmModal'


type Gender = 'male' | 'female' | 'other' | 'unknown'

type StudentRow = {
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

type StudentForm = {
  name: string
  lastname: string
  amka: string
  gender: Gender
  birthdate: string // yyyy-mm-dd

  address: string
  city: string
  phone: string
  email: string

  parent_name: string
  parent_phone1: string
  parent_phone2: string

  active: boolean
  doctor_visit: boolean
  doctor_name: string
}

const EMPTY_FORM: StudentForm = {
  name: '',
  lastname: '',
  amka: '',
  gender: 'unknown',
  birthdate: '',
  address: '',
  city: '',
  phone: '',
  email: '',
  parent_name: '',
  parent_phone1: '',
  parent_phone2: '',
  active: true,
  doctor_visit: false,
  doctor_name: '',
}

function cx(...arr: Array<string | false | undefined | null>) {
  return arr.filter(Boolean).join(' ')
}

function toForm(s?: StudentRow | null): StudentForm {
  if (!s) return { ...EMPTY_FORM }
  return {
    name: s.name ?? '',
    lastname: s.lastname ?? '',
    amka: s.amka ?? '',
    gender: (s.gender ?? 'unknown') as Gender,
    birthdate: s.birthdate ?? '',
    address: s.address ?? '',
    city: s.city ?? '',
    phone: s.phone ?? '',
    email: s.email ?? '',
    parent_name: s.parent_name ?? '',
    parent_phone1: s.parent_phone1 ?? '',
    parent_phone2: s.parent_phone2 ?? '',
    active: !!s.active,
    doctor_visit: !!s.doctor_visit,
    doctor_name: s.doctor_name ?? '',
  }
}

function formToDb(f: StudentForm) {
  return {
    name: f.name.trim(),
    lastname: f.lastname.trim(),
    amka: f.amka.trim() || null,
    gender: f.gender,
    birthdate: f.birthdate || null,

    address: f.address.trim() || null,
    city: f.city.trim() || null,
    phone: f.phone.trim() || null,
    email: f.email.trim() || null,

    parent_name: f.parent_name.trim() || null,
    parent_phone1: f.parent_phone1.trim() || null,
    parent_phone2: f.parent_phone2.trim() || null,

    active: f.active,
    doctor_visit: f.doctor_visit,
    doctor_name: f.doctor_name.trim() || null,

    updated_at: new Date().toISOString(),
  }
}

async function getMyTenantId(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('id', userId)
    .single()

  if (error || !data?.tenant_id) {
    throw new Error('Δεν βρέθηκε tenant για τον χρήστη.')
  }
  return data.tenant_id as string
}



export default function StudentsPage() {
  const { user } = useAuth()

  const [tenantId, setTenantId] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [rows, setRows] = useState<StudentRow[]>([])
  const [query, setQuery] = useState('')

  // modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<StudentRow | null>(null) // null => create
  const [form, setForm] = useState<StudentForm>({ ...EMPTY_FORM })

  // pagination
  const PAGE_SIZE = 15
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  // delete confirm modal
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteRow, setDeleteRow] = useState<StudentRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const STUDENT_SELECT =
    'user_id,tenant_id,name,lastname,amka,gender,birthdate,address,city,phone,email,parent_name,parent_phone1,parent_phone2,active,doctor_visit,doctor_name,created_at,updated_at'

  useEffect(() => {
    let cancelled = false
    async function boot() {
      if (!user?.id) return
      setError(null)
      try {
        const t = await getMyTenantId(user.id)
        if (!cancelled) setTenantId(t)
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Σφάλμα tenant.')
      }
    }
    boot()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  async function fetchStudents(tid: string, p = page, q = query) {
    setLoading(true)
    setError(null)

    const from = (p - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let req = supabase
      .from('students')
      .select(STUDENT_SELECT, { count: 'exact' })
      .eq('tenant_id', tid)

    const qq = q.trim()
    if (qq) {
      const safe = qq.replace(/,/g, ' ')
      req = req.or(
        `name.ilike.%${safe}%,lastname.ilike.%${safe}%,phone.ilike.%${safe}%,email.ilike.%${safe}%,amka.ilike.%${safe}%,city.ilike.%${safe}%`,
      )
    }

    const { data, error, count } = await req
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      setError(error.message)
      setRows([])
      setTotal(0)
    } else {
      setRows((data ?? []) as StudentRow[])
      setTotal(count ?? 0)
    }

    setLoading(false)
  }

  useEffect(() => {
    if (!tenantId) return
    fetchStudents(tenantId, page, query)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, page])

  useEffect(() => {
    if (!tenantId) return
    setPage(1)
    fetchStudents(tenantId, 1, query)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, tenantId])

  function openCreate() {
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setModalOpen(true)
  }

  function openEdit(r: StudentRow) {
    setEditing(r)
    setForm(toForm(r))
    setModalOpen(true)
  }

  function closeModal() {
    if (saving) return
    setModalOpen(false)
    setEditing(null)
    setForm({ ...EMPTY_FORM })
  }

  function setField<K extends keyof StudentForm>(k: K, v: StudentForm[K]) {
    setForm((prev) => ({ ...prev, [k]: v }))
  }

  function validate(f: StudentForm) {
    if (!f.name.trim()) return 'Το όνομα είναι υποχρεωτικό.'
    if (!f.lastname.trim()) return 'Το επώνυμο είναι υποχρεωτικό.'
    return null
  }

  async function onSave() {
    if (!tenantId) return
    const v = validate(form)
    if (v) {
      setError(v)
      return
    }

    setSaving(true)
    setError(null)

    try {
      if (!editing) {
        // ✅ CREATE (instant UI update)
        const newId =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`

        const payload = {
          user_id: newId,
          tenant_id: tenantId,
          ...formToDb(form),
          created_at: new Date().toISOString(),
        }

        const { data: inserted, error } = await supabase
          .from('students')
          .insert(payload)
          .select(STUDENT_SELECT)
          .single()

        if (error) throw error

        // άμεση εμφάνιση στο UI
        setRows((prev) => [inserted as StudentRow, ...prev])
        setTotal((t) => t + 1)

        // πήγαινε σε 1η σελίδα (έτσι το βλέπεις πάντα πρώτο)
        setPage(1)

        closeModal()

        // background sync (για pagination/search ακρίβεια)
        fetchStudents(tenantId, 1, query)
      } else {
        // ✅ UPDATE (instant UI update)
        const payload = formToDb(form)

        const { data: updated, error } = await supabase
          .from('students')
          .update(payload)
          .eq('tenant_id', tenantId)
          .eq('user_id', editing.user_id)
          .select(STUDENT_SELECT)
          .single()

        if (error) throw error

        setRows((prev) =>
          prev.map((x) => (x.user_id === editing.user_id ? (updated as StudentRow) : x)),
        )

        closeModal()

        // background sync
        fetchStudents(tenantId, page, query)
      }
    } catch (e: any) {
      setError(e?.message ?? 'Σφάλμα αποθήκευσης.')
    } finally {
      setSaving(false)
    }
  }

  async function onToggleActive(r: StudentRow, next: boolean) {
    if (!tenantId) return

    // optimistic
    setRows((prev) =>
      prev.map((x) => (x.user_id === r.user_id ? { ...x, active: next } : x)),
    )

    const { error } = await supabase
      .from('students')
      .update({ active: next, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('user_id', r.user_id)

    if (error) {
      // rollback
      setRows((prev) =>
        prev.map((x) => (x.user_id === r.user_id ? { ...x, active: r.active } : x)),
      )
      setError(error.message)
    }
  }

  function askDelete(r: StudentRow) {
    setDeleteRow(r)
    setDeleteOpen(true)
  }

  async function confirmDelete() {
    if (!tenantId || !deleteRow) return
    setDeleting(true)
    setError(null)

    const { error } = await supabase
      .from('students')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('user_id', deleteRow.user_id)

    if (error) {
      setError(error.message)
      setDeleting(false)
      return
    }

    setDeleteOpen(false)
    setDeleteRow(null)
    setDeleting(false)

    const newTotal = Math.max(0, total - 1)
    const newTotalPages = Math.max(1, Math.ceil(newTotal / PAGE_SIZE))
    const nextPage = Math.min(page, newTotalPages)
    setPage(nextPage)

    fetchStudents(tenantId, nextPage, query)
  }

  return (
    <div className="rounded-2xl border border-border bg-panel p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-base font-semibold">Μαθητές</div>
          <div className="text-xs text-muted">Διαχείριση μαθητών</div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            className="input w-full sm:w-72"
            placeholder="Αναζήτηση (όνομα, τηλ, email, ΑΜΚΑ...)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="btn btn-primary" onClick={openCreate}>
            + Προσθήκη μαθητή
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-3 rounded-xl border border-border bg-panel2 p-3 text-sm">
          <span style={{ color: 'var(--color-danger)' }}>{error}</span>
        </div>
      )}

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
                    <div className="text-xs text-muted">{r.parent_phone1 ?? '—'}</div>
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
                      <button className="btn" onClick={() => openEdit(r)}>
                        Edit
                      </button>
                      <button className="btn btn-danger" onClick={() => askDelete(r)}>
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

      {/* Pagination */}
      <div className="mt-3 flex items-center justify-between text-sm">
        <div className="text-muted">
          Σύνολο: <span className="text-text">{total}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="btn"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Prev
          </button>
          <div className="text-muted">
            Σελίδα <span className="text-text">{page}</span> /{' '}
            <span className="text-text">{totalPages}</span>
          </div>
          <button
            className="btn"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Next
          </button>
        </div>
      </div>

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        title={editing ? 'Επεξεργασία μαθητή' : 'Προσθήκη μαθητή'}
        onClose={closeModal}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <div className="mb-1 text-xs text-muted">Όνομα *</div>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
            />
          </div>

          <div>
            <div className="mb-1 text-xs text-muted">Επώνυμο *</div>
            <input
              className="input"
              value={form.lastname}
              onChange={(e) => setField('lastname', e.target.value)}
            />
          </div>

          <div>
            <div className="mb-1 text-xs text-muted">ΑΜΚΑ</div>
            <input
              className="input"
              value={form.amka}
              onChange={(e) => setField('amka', e.target.value)}
            />
          </div>

          <div>
            <div className="mb-1 text-xs text-muted">Φύλο</div>
            <select
              className="input"
              value={form.gender}
              onChange={(e) => setField('gender', e.target.value as Gender)}
            >
              <option value="unknown">unknown</option>
              <option value="male">male</option>
              <option value="female">female</option>
              <option value="other">other</option>
            </select>
          </div>

          <div>
            <div className="mb-1 text-xs text-muted">Ημ. Γέννησης</div>
            <input
              className="input"
              type="date"
              value={form.birthdate}
              onChange={(e) => setField('birthdate', e.target.value)}
            />
          </div>

          <div>
            <div className="mb-1 text-xs text-muted">Πόλη</div>
            <input
              className="input"
              value={form.city}
              onChange={(e) => setField('city', e.target.value)}
            />
          </div>

          <div>
            <div className="mb-1 text-xs text-muted">Διεύθυνση</div>
            <input
              className="input"
              value={form.address}
              onChange={(e) => setField('address', e.target.value)}
            />
          </div>

          <div>
            <div className="mb-1 text-xs text-muted">Τηλέφωνο</div>
            <input
              className="input"
              value={form.phone}
              onChange={(e) => setField('phone', e.target.value)}
            />
          </div>

          <div>
            <div className="mb-1 text-xs text-muted">Email</div>
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(e) => setField('email', e.target.value)}
            />
          </div>

          <div>
            <div className="mb-1 text-xs text-muted">Όνομα Γονέα</div>
            <input
              className="input"
              value={form.parent_name}
              onChange={(e) => setField('parent_name', e.target.value)}
            />
          </div>

          <div>
            <div className="mb-1 text-xs text-muted">Τηλ. Γονέα 1</div>
            <input
              className="input"
              value={form.parent_phone1}
              onChange={(e) => setField('parent_phone1', e.target.value)}
            />
          </div>

          <div>
            <div className="mb-1 text-xs text-muted">Τηλ. Γονέα 2</div>
            <input
              className="input"
              value={form.parent_phone2}
              onChange={(e) => setField('parent_phone2', e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setField('active', e.target.checked)}
              />
              <span className="text-sm">Active</span>
            </label>

            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.doctor_visit}
                onChange={(e) => setField('doctor_visit', e.target.checked)}
              />
              <span className="text-sm">Doctor visit</span>
            </label>
          </div>

          <div>
            <div className="mb-1 text-xs text-muted">Γιατρός</div>
            <input
              className="input"
              value={form.doctor_name}
              onChange={(e) => setField('doctor_name', e.target.value)}
              disabled={!form.doctor_visit}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button className="btn" onClick={closeModal} disabled={saving}>
            Ακύρωση
          </button>
          <button
            className={cx('btn btn-success', saving && 'opacity-70')}
            onClick={onSave}
            disabled={saving}
          >
            {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
          </button>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <ConfirmModal
        open={deleteOpen}
        title="Επιβεβαίωση διαγραφής"
        message={
          deleteRow
            ? `Να διαγραφεί ο μαθητής:\n${deleteRow.lastname} ${deleteRow.name}\n\nΗ ενέργεια δεν αναιρείται.`
            : ''
        }
        confirmText="Διαγραφή"
        busy={deleting}
        onClose={() => (!deleting ? setDeleteOpen(false) : null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

// src/pages/DocOpinionPage.tsx
import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/auth/AuthProvider";

import DocOpinionTable, {
  type DocOpinionRow,
} from "@/components/docOpinion/DocOpinionTable";
import DocOpinionModal from "@/components/docOpinion/DocOpinionModal";
import DocOpinionConfirmModal from "@/components/docOpinion/DocOpinionConfirmModal";

type StudentRow = { user_id: string; name: string; lastname: string };

type DocOpinionForm = {
  student_id: string;
  start_date: string;
  end_date: string;
  notes: string;
};

const EMPTY_FORM: DocOpinionForm = {
  student_id: "",
  start_date: "",
  end_date: "",
  notes: "",
};

async function getMyTenantId(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", userId)
    .single();

  if (error || !data?.tenant_id) {
    throw new Error("Δεν βρέθηκε tenant για τον χρήστη.");
  }
  return data.tenant_id as string;
}

function toForm(r?: DocOpinionRow | null): DocOpinionForm {
  if (!r) return { ...EMPTY_FORM };
  return {
    student_id: r.student_id ?? "",
    start_date: r.start_date ?? "",
    end_date: r.end_date ?? "",
    notes: r.notes ?? "",
  };
}

function formToDb(f: DocOpinionForm) {
  return {
    student_id: f.student_id,
    start_date: f.start_date,
    end_date: f.end_date || null,
    notes: f.notes.trim() || null,
    updated_at: new Date().toISOString(),
  };
}

export default function DocOpinionPage() {
  const { user } = useAuth();

  const [tenantId, setTenantId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rows, setRows] = useState<DocOpinionRow[]>([]);
  const [query, setQuery] = useState("");

  // students for dropdown
  const [students, setStudents] = useState<StudentRow[]>([]);

  // modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DocOpinionRow | null>(null);
  const [form, setForm] = useState<DocOpinionForm>({ ...EMPTY_FORM });

  // pagination
  const PAGE_SIZE = 15;
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // delete confirm
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteRow, setDeleteRow] = useState<DocOpinionRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ✅ joined student as object
  const SELECT =
    "id,tenant_id,student_id,start_date,end_date,notes,created_at,updated_at, student:students(name,lastname)";

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (!user?.id) return;
      try {
        const t = await getMyTenantId(user.id);
        if (!cancelled) setTenantId(t);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Σφάλμα tenant.");
      }
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  async function fetchStudents(tid: string) {
    const { data, error } = await supabase
      .from("students")
      .select("user_id,name,lastname")
      .eq("tenant_id", tid)
      .order("lastname", { ascending: true });

    if (error) {
      setError(error.message);
      setStudents([]);
      return;
    }

    setStudents((data ?? []) as StudentRow[]);
  }

  async function fetchDocOpinions(tid: string, p = page, q = query) {
    setLoading(true);
    setError(null);

    const from = (p - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let req = supabase
      .from("doc_opinion")
      .select(SELECT, { count: "exact" })
      .eq("tenant_id", tid);

    const qq = q.trim();
    if (qq) {
      const safe = qq.replace(/,/g, " ");
      // ✅ πιο safe search (χωρίς ::text)
      req = req.or(`notes.ilike.%${safe}%,student_id.ilike.%${safe}%`);
    }

    const { data, error, count } = await req
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      setError(error.message);
      setRows([]);
      setTotal(0);
    } else {
      const transformed = (data ?? []).map((item: any) => ({
  ...item,
  student: Array.isArray(item.student)
    ? item.student[0] ?? null
    : item.student ?? null,
})) as DocOpinionRow[];

setRows(transformed);
      setTotal(count ?? 0);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (!tenantId) return;
    fetchStudents(tenantId);
    fetchDocOpinions(tenantId, page, query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, page]);

  useEffect(() => {
    if (!tenantId) return;
    setPage(1);
    fetchDocOpinions(tenantId, 1, query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, tenantId]);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  }

  function openEdit(r: DocOpinionRow) {
    setEditing(r);
    setForm(toForm(r));
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
    setForm({ ...EMPTY_FORM });
  }

  function setField<K extends keyof DocOpinionForm>(k: K, v: DocOpinionForm[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  function validate(f: DocOpinionForm) {
    if (!f.student_id) return "Πρέπει να επιλέξεις μαθητή.";
    if (!f.start_date) return "Η ημ/νία έναρξης είναι υποχρεωτική.";
    return null;
  }

  async function onSave() {
    if (!tenantId) return;

    const v = validate(form);
    if (v) {
      setError(v);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (!editing) {
        const payload = {
          tenant_id: tenantId,
          ...formToDb(form),
          created_at: new Date().toISOString(),
        };

        const { data: inserted, error } = await supabase
          .from("doc_opinion")
          .insert(payload)
          .select(SELECT)
          .single();

        if (error) throw error;

        const transformedInserted = {
  ...inserted,
  student: Array.isArray(inserted.student)
    ? inserted.student[0] ?? null
    : inserted.student ?? null,
} as DocOpinionRow;

setRows((prev) => [transformedInserted, ...prev]);
        setTotal((t) => t + 1);
        setPage(1);

        closeModal();
        fetchDocOpinions(tenantId, 1, query);
      } else {
        const payload = formToDb(form);

        const { data: updated, error } = await supabase
          .from("doc_opinion")
          .update(payload)
          .eq("tenant_id", tenantId)
          .eq("id", editing.id)
          .select(SELECT)
          .single();

        if (error) throw error;

        const transformedUpdated = {
  ...updated,
  student: Array.isArray(updated.student)
    ? updated.student[0] ?? null
    : updated.student ?? null,
} as DocOpinionRow;

setRows((prev) =>
  prev.map((x) => (x.id === editing.id ? transformedUpdated : x))
);

        closeModal();
        fetchDocOpinions(tenantId, page, query);
      }
    } catch (e: any) {
      setError(e?.message ?? "Σφάλμα αποθήκευσης.");
    } finally {
      setSaving(false);
    }
  }

  function askDelete(r: DocOpinionRow) {
    setDeleteRow(r);
    setDeleteOpen(true);
  }

  function closeDelete() {
    if (deleting) return;
    setDeleteOpen(false);
    setDeleteRow(null);
  }

  async function confirmDelete() {
    if (!tenantId || !deleteRow) return;
    setDeleting(true);
    setError(null);

    try {
      const { error } = await supabase
        .from("doc_opinion")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("id", deleteRow.id);

      if (error) throw error;

      const newTotal = Math.max(0, total - 1);
      const newTotalPages = Math.max(1, Math.ceil(newTotal / PAGE_SIZE));
      const nextPage = Math.min(page, newTotalPages);
      setPage(nextPage);

      closeDelete();
      fetchDocOpinions(tenantId, nextPage, query);
    } catch (e: any) {
      setError(e?.message ?? "Σφάλμα διαγραφής.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-panel p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-base font-semibold">Γνωματεύσεις</div>
          <div className="text-xs text-muted">Διαχείριση γνωματεύσεων</div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            className="input w-full sm:w-72"
            placeholder="Αναζήτηση (notes, student id...)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="btn btn-primary" onClick={openCreate}>
            + Προσθήκη γνωμάτευσης
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-3 rounded-xl border border-border bg-panel2 p-3 text-sm">
          <span style={{ color: "var(--color-danger)" }}>{error}</span>
        </div>
      )}

      <DocOpinionTable
        rows={rows}
        loading={loading}
        onEdit={openEdit}
        onDelete={askDelete}
      />

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
            Σελίδα <span className="text-text">{page}</span> /{" "}
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
      <DocOpinionModal
        open={modalOpen}
        title={editing ? "Επεξεργασία γνωμάτευσης" : "Προσθήκη γνωμάτευσης"}
        onClose={closeModal}
        lockClose={saving}
        maxWidthClass="max-w-3xl"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <div className="mb-1 text-xs text-muted">Μαθητής *</div>
            <select
              className="input"
              value={form.student_id}
              onChange={(e) => setField("student_id", e.target.value)}
            >
              <option value="">— Επιλογή —</option>
              {students.map((s) => (
                <option key={s.user_id} value={s.user_id}>
                  {s.lastname} {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-1 text-xs text-muted">Ημ. Έναρξης *</div>
            <input
              className="input"
              type="date"
              value={form.start_date}
              onChange={(e) => setField("start_date", e.target.value)}
            />
          </div>

          <div>
            <div className="mb-1 text-xs text-muted">Ημ. Λήξης</div>
            <input
              className="input"
              type="date"
              value={form.end_date}
              onChange={(e) => setField("end_date", e.target.value)}
            />
          </div>

          <div className="md:col-span-2">
            <div className="mb-1 text-xs text-muted">Σημειώσεις</div>
            <textarea
              className="input min-h-24"
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button className="btn" onClick={closeModal} disabled={saving}>
            Άκυρο
          </button>
          <button className="btn btn-primary" onClick={onSave} disabled={saving}>
            {saving ? "Αποθήκευση..." : "Αποθήκευση"}
          </button>
        </div>
      </DocOpinionModal>

      {/* Delete confirm */}
      <DocOpinionConfirmModal
        open={deleteOpen}
        title="Διαγραφή γνωμάτευσης"
        message="Θέλεις σίγουρα να διαγράψεις αυτή τη γνωμάτευση;"
        confirmText="Διαγραφή"
        cancelText="Ακύρωση"
        danger
        busy={deleting}
        onConfirm={confirmDelete}
        onClose={closeDelete}
      />
    </div>
  );
}
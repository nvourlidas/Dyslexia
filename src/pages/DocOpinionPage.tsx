// src/pages/DocOpinionPage.tsx
import { useEffect, useMemo, useState } from "react";
import { Sheet, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/auth/AuthProvider";
import { callFunction } from "@/lib/api";

import DocOpinionTable, {
  type DocOpinionRow,
  type DocOpinionColKey,
} from "@/components/docOpinion/DocOpinionTable";
import DocOpinionModal from "@/components/docOpinion/DocOpinionModal";
import DocOpinionConfirmModal from "@/components/docOpinion/DocOpinionConfirmModal";
import StudentsColumnsDropdown from "@/components/students/StudentsColumnsDropdown";
import BulkDeleteConfirmModal from "@/components/ui/BulkDeleteConfirmModal";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";

import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

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

const DOC_ALL_COLUMNS: { key: DocOpinionColKey; label: string }[] = [
  { key: "start_date", label: "Έναρξη" },
  { key: "end_date", label: "Λήξη" },
  { key: "notes", label: "Σημειώσεις" },
  { key: "created_at", label: "Ημ. Δημιουργίας" },
];

const DOC_DEFAULT_VISIBLE: DocOpinionColKey[] = ["start_date", "end_date", "notes"];

const DOC_ALL_KEYS = DOC_ALL_COLUMNS.map((c) => c.key) as DocOpinionColKey[];

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

  const [students, setStudents] = useState<StudentRow[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DocOpinionRow | null>(null);
  const [form, setForm] = useState<DocOpinionForm>({ ...EMPTY_FORM });

  const PAGE_SIZE = 15;
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteRow, setDeleteRow] = useState<DocOpinionRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const clearSelection = () => setSelectedIds([]);

  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const pageIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
  const toggleSelectPage = () => {
    setSelectedIds((prev) =>
      allPageSelected ? prev.filter((id) => !pageIds.includes(id)) : [...prev, ...pageIds.filter((id) => !prev.includes(id))]
    );
  };

  const { isColVisible, toggleCol, setAllCols, resetCols } =
    useColumnVisibility<DocOpinionColKey>({
      allKeys: DOC_ALL_KEYS,
      defaultVisible: DOC_DEFAULT_VISIBLE,
      storageKeyBase: "doc_opinion_table_visible_cols_v1",
      tenantId,
    });

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

  async function bulkDelete() {
    if (!tenantId || selectedIds.length === 0) return;
    setBulkDeleting(true);
    try {
      await callFunction("doc_opinion-bulk-delete", { ids: selectedIds });
      const deletedCount = selectedIds.length;
      clearSelection();
      setBulkDeleteOpen(false);
      const newTotal = Math.max(0, total - deletedCount);
      const newTotalPages = Math.max(1, Math.ceil(newTotal / PAGE_SIZE));
      const nextPage = Math.min(page, newTotalPages);
      setPage(nextPage);
      fetchDocOpinions(tenantId, nextPage, query);
    } catch (e: any) {
      setError(e?.message ?? "Σφάλμα διαγραφής.");
    } finally {
      setBulkDeleting(false);
    }
  }

  async function exportExcel() {
    if (!tenantId) return;

    const { data, error } = await supabase
      .from("doc_opinion")
      .select(SELECT)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error || !data) return;

    const allRows = (data ?? []).map((item: any) => ({
      ...item,
      student: Array.isArray(item.student)
        ? item.student[0] ?? null
        : item.student ?? null,
    })) as DocOpinionRow[];

    const exportData = allRows.map((r) => {
      const fullName =
        r.student?.lastname || r.student?.name
          ? `${r.student?.lastname ?? ""} ${r.student?.name ?? ""}`.trim()
          : r.student_id;

      const obj: Record<string, any> = { Μαθητής: fullName };
      if (isColVisible("start_date")) obj["Έναρξη"] = r.start_date;
      if (isColVisible("end_date")) obj["Λήξη"] = r.end_date ?? "";
      if (isColVisible("notes")) obj["Σημειώσεις"] = r.notes ?? "";
      if (isColVisible("created_at")) obj["Ημ. Δημιουργίας"] = r.created_at?.slice(0, 10) ?? "";
      return obj;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Γνωματεύσεις");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, `doc_opinions_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

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
        await callFunction<{ id: string }>("doc_opinion-create", {
          student_id: form.student_id,
          start_date: form.start_date,
          end_date: form.end_date || null,
          notes: form.notes.trim() || null,
        });

        closeModal();
        setPage(1);
        await fetchDocOpinions(tenantId, 1, query);
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
      const code = e?.code as string | undefined;

      if (code === "SUBSCRIPTION_INACTIVE") {
        setError(e?.message ?? "Απαιτείται ενεργή συνδρομή.");
        return;
      }

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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold">Γνωματεύσεις</div>
          <div className="text-xs text-muted">Διαχείριση γνωματεύσεων</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            className="input w-full sm:w-72"
            placeholder="Αναζήτηση (notes, student id...)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <StudentsColumnsDropdown
            columns={DOC_ALL_COLUMNS}
            isColVisible={isColVisible}
            toggleCol={toggleCol}
            setAllCols={setAllCols}
            resetCols={resetCols}
          />
          <button className="btn btn-primary" onClick={openCreate}>
            + Προσθήκη γνωμάτευσης
          </button>
        </div>
      </div>

      <div className="mt-2 mb-1 flex flex-wrap items-center gap-2">
        <button
          className="h-9 rounded-md px-3 text-sm border border-border/15 inline-flex items-center gap-2 text-text-primary hover:bg-[#26a347] hover:border-white/15 hover:text-white cursor-pointer"
          onClick={exportExcel}
          disabled={loading || total === 0}
          title="Export Excel"
        >
          <Sheet className="h-4 w-4" />
          Εξαγωγή Excel
        </button>

        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">
              Επιλεγμένα: <span className="font-semibold text-text">{selectedIds.length}</span>{" "}
              <button type="button" className="underline" onClick={clearSelection}>(καθαρισμός)</button>
            </span>
            <button
              type="button"
              className="h-8 rounded-md px-3 text-xs border border-red-400/60 text-red-400 hover:bg-red-500/10 inline-flex items-center gap-1.5 cursor-pointer"
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Διαγραφή επιλεγμένων
            </button>
          </div>
        )}
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
        isColVisible={isColVisible}
        selectedIds={selectedIds}
        toggleSelect={toggleSelect}
        allPageSelected={allPageSelected}
        toggleSelectPage={toggleSelectPage}
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

      <BulkDeleteConfirmModal
        open={bulkDeleteOpen}
        count={selectedIds.length}
        entityLabel="γνωματεύσεις"
        busy={bulkDeleting}
        onConfirm={bulkDelete}
        onClose={() => setBulkDeleteOpen(false)}
      />

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

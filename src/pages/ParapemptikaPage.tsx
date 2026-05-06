// src/pages/ParapemptikaPage.tsx
import { useEffect, useMemo, useState } from "react";
import { Sheet, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/auth/AuthProvider";
import { callFunction } from "@/lib/api";

import ParapemptikoTable, {
  type ParapemtikoRow,
  type ParapemptikoColKey,
} from "@/components/parapemptiko/ParapemptikoTable";

import ParapemptikoModal from "@/components/parapemptiko/ParapemptikoModal";
import ParapemptikoConfirmModal from "@/components/parapemptiko/ParapemptikoConfirmModal";
import StudentsColumnsDropdown from "@/components/students/StudentsColumnsDropdown";
import BulkDeleteConfirmModal from "@/components/ui/BulkDeleteConfirmModal";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";

import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

type StudentOption = { user_id: string; name: string | null; lastname: string | null; amka: string | null };

type ParapemtikoForm = {
  title: string;
  student_id: string;
  code: string;
  code_diagnosis: string;
  start_date: string;
  end_date: string;
  status: string;
  notes: string;
};

const EMPTY_FORM: ParapemtikoForm = {
  title: "",
  student_id: "",
  code: "",
  code_diagnosis: "",
  start_date: "",
  end_date: "",
  status: "pending",
  notes: "",
};

const PARAP_ALL_COLUMNS: { key: ParapemptikoColKey; label: string }[] = [
  { key: "amka", label: "ΑΜΚΑ" },
  { key: "code", label: "Κωδικός" },
  { key: "code_diagnosis", label: "Κωδ. Διάγνωσης" },
  { key: "start_date", label: "Έναρξη" },
  { key: "end_date", label: "Λήξη" },
  { key: "notes", label: "Σημειώσεις" },
  { key: "created_at", label: "Ημ. Δημιουργίας" },
];

const PARAP_DEFAULT_VISIBLE: ParapemptikoColKey[] = ["amka", "code", "code_diagnosis", "end_date"];
const PARAP_ALL_KEYS = PARAP_ALL_COLUMNS.map((c) => c.key) as ParapemptikoColKey[];

function formPayload(f: ParapemtikoForm) {
  return {
    title: f.title.trim(),
    student_id: f.student_id || null,
    code: f.code.trim() || null,
    code_diagnosis: f.code_diagnosis.trim() || null,
    start_date: f.start_date,
    end_date: f.end_date || null,
    status: f.status,
    notes: f.notes.trim() || null,
  };
}

function toForm(r?: ParapemtikoRow | null): ParapemtikoForm {
  if (!r) return { ...EMPTY_FORM };
  return {
    title: r.title ?? "",
    student_id: r.student_id ?? "",
    code: r.code ?? "",
    code_diagnosis: r.code_diagnosis ?? "",
    start_date: r.start_date ?? "",
    end_date: r.end_date ?? "",
    status: r.status ?? "pending",
    notes: r.notes ?? "",
  };
}

async function getMyTenantId(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", userId)
    .single();
  if (error || !data?.tenant_id)
    throw new Error("Δεν βρέθηκε tenant για τον χρήστη.");
  return data.tenant_id as string;
}

export default function ParapemptikaPage() {
  const { user } = useAuth();

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rows, setRows] = useState<ParapemtikoRow[]>([]);
  const [query, setQuery] = useState("");

  const [students, setStudents] = useState<StudentOption[]>([]);
  const [recordStudentIds, setRecordStudentIds] = useState<Set<string>>(new Set());

  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "completed">("all");
  const [amkaFilter, setAmkaFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState<"all" | "expired" | "active" | "none">("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ParapemtikoRow | null>(null);
  const [form, setForm] = useState<ParapemtikoForm>({ ...EMPTY_FORM });

  const PAGE_SIZE = 15;
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteRow, setDeleteRow] = useState<ParapemtikoRow | null>(null);
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
      allPageSelected
        ? prev.filter((id) => !pageIds.includes(id))
        : [...prev, ...pageIds.filter((id) => !prev.includes(id))]
    );
  };

  const { isColVisible, toggleCol, setAllCols, resetCols } =
    useColumnVisibility<ParapemptikoColKey>({
      allKeys: PARAP_ALL_KEYS,
      defaultVisible: PARAP_DEFAULT_VISIBLE,
      storageKeyBase: "parapemptiko_table_visible_cols_v1",
      tenantId,
    });

  // Boot: load tenant id
  useEffect(() => {
    let cancelled = false;
    async function boot() {
      if (!user?.id) return;
      setError(null);
      try {
        const t = await getMyTenantId(user.id);
        if (!cancelled) setTenantId(t);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Σφάλμα tenant.");
      }
    }
    boot();
    return () => { cancelled = true; };
  }, [user?.id]);

  async function fetchStudents(tid: string) {
    const { data, error } = await supabase
      .from("students")
      .select("user_id,name,lastname,amka")
      .eq("tenant_id", tid)
      .eq("active", true)
      .order("lastname", { ascending: true });
    if (error) { setError(error.message); return; }
    setStudents((data ?? []) as StudentOption[]);
  }

  async function fetchRecordStudentIds(tid: string) {
    const { data } = await supabase
      .from("parapemtiko")
      .select("student_id")
      .eq("tenant_id", tid)
      .not("student_id", "is", null);
    setRecordStudentIds(new Set((data ?? []).map((r: any) => r.student_id)));
  }

  async function fetchParapemtika(
    p = page,
    q = query,
    sf = statusFilter,
    af = amkaFilter,
    edf = endDateFilter
  ) {
    setLoading(true);
    setError(null);
    try {
      const result = await callFunction<{ rows: ParapemtikoRow[]; total: number }>(
        "parapemptiko-list",
        { page: p, page_size: PAGE_SIZE, query: q, status_filter: sf, student_id_filter: af, end_date_filter: edf }
      );
      setRows(result.rows);
      setTotal(result.total);
    } catch (e: any) {
      setError(e?.message ?? "Σφάλμα φόρτωσης.");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!tenantId) return;
    fetchStudents(tenantId);
    fetchRecordStudentIds(tenantId);
    fetchParapemtika(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, page]);

  useEffect(() => {
    if (!tenantId) return;
    setPage(1);
    fetchParapemtika(1, query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    setPage(1);
    fetchParapemtika(1, query, statusFilter, amkaFilter, endDateFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, amkaFilter, endDateFilter]);

  async function bulkDelete() {
    if (selectedIds.length === 0) return;
    setBulkDeleting(true);
    try {
      await callFunction("parapemptiko-bulk-delete", { ids: selectedIds });
      const newTotal = Math.max(0, total - selectedIds.length);
      const nextPage = Math.min(page, Math.max(1, Math.ceil(newTotal / PAGE_SIZE)));
      clearSelection();
      setBulkDeleteOpen(false);
      setPage(nextPage);
      await fetchParapemtika(nextPage);
    } catch (e: any) {
      setError(e?.message ?? "Σφάλμα διαγραφής.");
    } finally {
      setBulkDeleting(false);
    }
  }

  async function exportExcel() {
    if (!tenantId) return;
    const SELECT =
      "id,tenant_id,title,student_id,doc_opinion_id,code,code_diagnosis,start_date,end_date,status,notes,created_at,updated_at,student:students(name,lastname,amka)";

    const { data, error } = await supabase
      .from("parapemtiko")
      .select(SELECT)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error || !data) return;

    const exportData = data.map((item: any) => {
      const r = { ...item, student: Array.isArray(item.student) ? item.student[0] ?? null : item.student ?? null };
      const statusLabel = r.status === "completed" ? "Ολοκληρωμένο" : "Εκκρεμεί";
      const obj: Record<string, any> = { Τίτλος: r.title, Κατάσταση: statusLabel };
      if (isColVisible("amka")) obj["ΑΜΚΑ"] = r.student?.amka ?? "";
      if (isColVisible("code")) obj["Κωδικός"] = r.code ?? "";
      if (isColVisible("code_diagnosis")) obj["Κωδ. Διάγνωσης"] = r.code_diagnosis ?? "";
      if (isColVisible("start_date")) obj["Έναρξη"] = r.start_date;
      if (isColVisible("end_date")) obj["Λήξη"] = r.end_date ?? "";
      if (isColVisible("notes")) obj["Σημειώσεις"] = r.notes ?? "";
      if (isColVisible("created_at")) obj["Ημ. Δημιουργίας"] = r.created_at?.slice(0, 10) ?? "";
      return obj;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Παραπεμπτικά");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      `parapemptika_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  }

  function openEdit(r: ParapemtikoRow) {
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

  function setField<K extends keyof ParapemtikoForm>(k: K, v: ParapemtikoForm[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  function validate(f: ParapemtikoForm) {
    if (!f.title.trim()) return "Ο τίτλος είναι υποχρεωτικός.";
    if (!f.student_id) return "Πρέπει να επιλέξεις μαθητή.";
    if (!f.start_date) return "Η ημ/νία έναρξης είναι υποχρεωτική.";
    return null;
  }

  async function onSave() {
    const v = validate(form);
    if (v) { setError(v); return; }

    setSaving(true);
    setError(null);

    try {
      if (!editing) {
        await callFunction("parapemptiko-create", formPayload(form));
        setPage(1);
        closeModal();
        await fetchParapemtika(1);
      } else {
        await callFunction("parapemptiko-update", { id: editing.id, ...formPayload(form) });
        closeModal();
        await fetchParapemtika(page);
      }
    } catch (e: any) {
      setError(e?.message ?? "Σφάλμα αποθήκευσης.");
    } finally {
      setSaving(false);
    }
  }

  function askDelete(r: ParapemtikoRow) {
    setDeleteRow(r);
    setDeleteOpen(true);
  }

  function closeDelete() {
    if (deleting) return;
    setDeleteOpen(false);
    setDeleteRow(null);
  }

  async function confirmDelete() {
    if (!deleteRow) return;
    setDeleting(true);
    setError(null);
    try {
      await callFunction("parapemptiko-delete", { id: deleteRow.id });
      const newTotal = Math.max(0, total - 1);
      const nextPage = Math.min(page, Math.max(1, Math.ceil(newTotal / PAGE_SIZE)));
      setPage(nextPage);
      closeDelete();
      await fetchParapemtika(nextPage);
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
          <div className="text-base font-semibold">Παραπεμπτικά</div>
          <div className="text-xs text-muted">Διαχείριση παραπεμπτικών</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            className="input w-full sm:w-72"
            placeholder="Αναζήτηση (όνομα, ΑΜΚΑ, κωδικός, διάγνωση...)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <StudentsColumnsDropdown
            columns={PARAP_ALL_COLUMNS}
            isColVisible={isColVisible}
            toggleCol={toggleCol}
            setAllCols={setAllCols}
            resetCols={resetCols}
          />
          <button className="btn btn-primary" onClick={openCreate}>
            + Προσθήκη παραπεμπτικού
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

        <select
          className="h-9 rounded-md px-2 text-sm border border-border/30 bg-panel2 text-text cursor-pointer"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
        >
          <option value="all">Κατάσταση: Όλες</option>
          <option value="pending">Εκκρεμεί</option>
          <option value="completed">Ολοκληρωμένο</option>
        </select>

        <select
          className="h-9 rounded-md px-2 text-sm border border-border/30 bg-panel2 text-text cursor-pointer"
          value={amkaFilter}
          onChange={(e) => setAmkaFilter(e.target.value)}
        >
          <option value="">ΑΜΚΑ: Όλα</option>
          {students
            .filter((s) => s.amka && recordStudentIds.has(s.user_id))
            .map((s) => (
              <option key={s.user_id} value={s.user_id}>
                {s.amka} — {`${s.lastname ?? ""} ${s.name ?? ""}`.trim()}
              </option>
            ))}
        </select>

        <select
          className="h-9 rounded-md px-2 text-sm border border-border/30 bg-panel2 text-text cursor-pointer"
          value={endDateFilter}
          onChange={(e) => setEndDateFilter(e.target.value as typeof endDateFilter)}
        >
          <option value="all">Λήξη: Όλες</option>
          <option value="expired">Ληγμένα</option>
          <option value="active">Ενεργά</option>
          <option value="none">Χωρίς λήξη</option>
        </select>

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

      <ParapemptikoTable
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

      <div className="mt-3 flex items-center justify-between text-sm">
        <div className="text-muted">
          Σύνολο: <span className="text-text">{total}</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            Prev
          </button>
          <div className="text-muted">
            Σελίδα <span className="text-text">{page}</span> / <span className="text-text">{totalPages}</span>
          </div>
          <button className="btn" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
            Next
          </button>
        </div>
      </div>

      <BulkDeleteConfirmModal
        open={bulkDeleteOpen}
        count={selectedIds.length}
        entityLabel="παραπεμπτικά"
        busy={bulkDeleting}
        onConfirm={bulkDelete}
        onClose={() => setBulkDeleteOpen(false)}
      />

      <ParapemptikoModal
        open={modalOpen}
        title={editing ? "Επεξεργασία παραπεμπτικού" : "Προσθήκη παραπεμπτικού"}
        onClose={closeModal}
        lockClose={saving}
        maxWidthClass="max-w-3xl"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <div className="mb-1 text-xs text-muted">Τίτλος *</div>
            <input className="input" value={form.title} onChange={(e) => setField("title", e.target.value)} />
          </div>

          <div className="md:col-span-2">
            <div className="mb-1 text-xs text-muted">Μαθητής *</div>
            <select className="input" value={form.student_id} onChange={(e) => setField("student_id", e.target.value)}>
              <option value="">— Επιλογή —</option>
              {students.map((s) => (
                <option key={s.user_id} value={s.user_id}>
                  {`${s.lastname ?? ""} ${s.name ?? ""}`.trim()}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-1 text-xs text-muted">Κωδικός</div>
            <input className="input" value={form.code} onChange={(e) => setField("code", e.target.value)} />
          </div>

          <div>
            <div className="mb-1 text-xs text-muted">Κωδ. Διάγνωσης</div>
            <input className="input" value={form.code_diagnosis} onChange={(e) => setField("code_diagnosis", e.target.value)} />
          </div>

          <div>
            <div className="mb-1 text-xs text-muted">Ημ. Έναρξης *</div>
            <input className="input" type="date" value={form.start_date} onChange={(e) => setField("start_date", e.target.value)} />
          </div>

          <div>
            <div className="mb-1 text-xs text-muted">Ημ. Λήξης</div>
            <input className="input" type="date" value={form.end_date} onChange={(e) => setField("end_date", e.target.value)} />
          </div>

          <div>
            <div className="mb-1 text-xs text-muted">Κατάσταση</div>
            <select className="input" value={form.status} onChange={(e) => setField("status", e.target.value)}>
              <option value="pending">Εκκρεμεί</option>
              <option value="completed">Ολοκληρωμένο</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <div className="mb-1 text-xs text-muted">Σημειώσεις</div>
            <textarea className="input min-h-24" value={form.notes} onChange={(e) => setField("notes", e.target.value)} />
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button className="btn" onClick={closeModal} disabled={saving}>Άκυρο</button>
          <button className="btn btn-primary" onClick={onSave} disabled={saving}>
            {saving ? "Αποθήκευση..." : "Αποθήκευση"}
          </button>
        </div>
      </ParapemptikoModal>

      <ParapemptikoConfirmModal
        open={deleteOpen}
        title="Διαγραφή παραπεμπτικού"
        message={`Θέλεις σίγουρα να διαγράψεις το "${deleteRow?.title ?? ""}" ;`}
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

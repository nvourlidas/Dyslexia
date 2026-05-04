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

type DocOpinionRow = {
  id: string;
  student_id: string;
  start_date: string;
  end_date: string | null;
  student?: { name: string | null; lastname: string | null } | null;
};

type ParapemtikoForm = {
  title: string;
  doc_opinion_id: string;
  code: string;
  code_diagnosis: string;
  start_date: string;
  end_date: string;
  status: string;
  notes: string;
};

const EMPTY_FORM: ParapemtikoForm = {
  title: "",
  doc_opinion_id: "",
  code: "",
  code_diagnosis: "",
  start_date: "",
  end_date: "",
  status: "active",
  notes: "",
};

const PARAP_ALL_COLUMNS: { key: ParapemptikoColKey; label: string }[] = [
  { key: "code", label: "Κωδικός" },
  { key: "code_diagnosis", label: "Κωδ. Διάγνωσης" },
  { key: "start_date", label: "Έναρξη" },
  { key: "end_date", label: "Λήξη" },
  { key: "status", label: "Status" },
  { key: "notes", label: "Σημειώσεις" },
  { key: "created_at", label: "Ημ. Δημιουργίας" },
];

const PARAP_DEFAULT_VISIBLE: ParapemptikoColKey[] = ["start_date", "end_date", "status"];

const PARAP_ALL_KEYS = PARAP_ALL_COLUMNS.map((c) => c.key) as ParapemptikoColKey[];

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

function toForm(r?: ParapemtikoRow | null): ParapemtikoForm {
  if (!r) return { ...EMPTY_FORM };
  return {
    title: r.title ?? "",
    doc_opinion_id: r.doc_opinion_id ?? "",
    code: r.code ?? "",
    code_diagnosis: r.code_diagnosis ?? "",
    start_date: r.start_date ?? "",
    end_date: r.end_date ?? "",
    status: r.status ?? "active",
    notes: r.notes ?? "",
  };
}

function formToDb(f: ParapemtikoForm) {
  return {
    title: f.title.trim(),
    doc_opinion_id: f.doc_opinion_id,
    code: f.code.trim() || null,
    code_diagnosis: f.code_diagnosis.trim() || null,
    start_date: f.start_date,
    end_date: f.end_date || null,
    status: f.status,
    notes: f.notes.trim() || null,
    updated_at: new Date().toISOString(),
  };
}

export default function ParapemptikaPage() {
  const { user } = useAuth();

  const [tenantId, setTenantId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rows, setRows] = useState<ParapemtikoRow[]>([]);
  const [query, setQuery] = useState("");

  const [docOpinions, setDocOpinions] = useState<DocOpinionRow[]>([]);

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
      allPageSelected ? prev.filter((id) => !pageIds.includes(id)) : [...prev, ...pageIds.filter((id) => !prev.includes(id))]
    );
  };

  const { isColVisible, toggleCol, setAllCols, resetCols } =
    useColumnVisibility<ParapemptikoColKey>({
      allKeys: PARAP_ALL_KEYS,
      defaultVisible: PARAP_DEFAULT_VISIBLE,
      storageKeyBase: "parapemptiko_table_visible_cols_v1",
      tenantId,
    });

  const PARAP_SELECT =
    "id,tenant_id,title,doc_opinion_id,code,code_diagnosis,start_date,end_date,status,notes,created_at,updated_at";

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
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  async function fetchDocOpinions(tid: string) {
    const SELECT =
      "id,student_id,start_date,end_date, student:students(name,lastname)";

    const { data, error } = await supabase
      .from("doc_opinion")
      .select(SELECT)
      .eq("tenant_id", tid)
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      setDocOpinions([]);
      return;
    }

    const transformed = (data ?? []).map((item: any) => ({
      ...item,
      student: Array.isArray(item.student)
        ? item.student[0] ?? null
        : item.student ?? null,
    })) as DocOpinionRow[];

    setDocOpinions(transformed);
  }

  async function fetchParapemtika(tid: string, p = page, q = query) {
    setLoading(true);
    setError(null);

    const from = (p - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let req = supabase
      .from("parapemtiko")
      .select(PARAP_SELECT, { count: "exact" })
      .eq("tenant_id", tid);

    const qq = q.trim();
    if (qq) {
      const safe = qq.replace(/,/g, " ");
      req = req.or(
        `title.ilike.%${safe}%,code.ilike.%${safe}%,code_diagnosis.ilike.%${safe}%,status.ilike.%${safe}%`
      );
    }

    const { data, error, count } = await req
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      setError(error.message);
      setRows([]);
      setTotal(0);
    } else {
      setRows((data ?? []) as ParapemtikoRow[]);
      setTotal(count ?? 0);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (!tenantId) return;
    fetchDocOpinions(tenantId);
    fetchParapemtika(tenantId, page, query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, page]);

  useEffect(() => {
    if (!tenantId) return;
    setPage(1);
    fetchParapemtika(tenantId, 1, query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, tenantId]);

  async function bulkDelete() {
    if (!tenantId || selectedIds.length === 0) return;
    setBulkDeleting(true);
    try {
      await callFunction("parapemptiko-bulk-delete", { ids: selectedIds });
      const deletedCount = selectedIds.length;
      clearSelection();
      setBulkDeleteOpen(false);
      const newTotal = Math.max(0, total - deletedCount);
      const newTotalPages = Math.max(1, Math.ceil(newTotal / PAGE_SIZE));
      const nextPage = Math.min(page, newTotalPages);
      setPage(nextPage);
      fetchParapemtika(tenantId, nextPage, query);
    } catch (e: any) {
      setError(e?.message ?? "Σφάλμα διαγραφής.");
    } finally {
      setBulkDeleting(false);
    }
  }

  async function exportExcel() {
    if (!tenantId) return;

    const { data, error } = await supabase
      .from("parapemtiko")
      .select(PARAP_SELECT)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error || !data) return;

    const allRows = (data ?? []) as ParapemtikoRow[];

    const exportData = allRows.map((r) => {
      const obj: Record<string, any> = { Τίτλος: r.title };
      if (isColVisible("code")) obj["Κωδικός"] = r.code ?? "";
      if (isColVisible("code_diagnosis")) obj["Κωδ. Διάγνωσης"] = r.code_diagnosis ?? "";
      if (isColVisible("start_date")) obj["Έναρξη"] = r.start_date;
      if (isColVisible("end_date")) obj["Λήξη"] = r.end_date ?? "";
      if (isColVisible("status")) obj["Status"] = r.status;
      if (isColVisible("notes")) obj["Σημειώσεις"] = r.notes ?? "";
      if (isColVisible("created_at")) obj["Ημ. Δημιουργίας"] = r.created_at?.slice(0, 10) ?? "";
      return obj;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Παραπεμπτικά");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, `parapemptika_${new Date().toISOString().slice(0, 10)}.xlsx`);
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

  function setField<K extends keyof ParapemtikoForm>(
    k: K,
    v: ParapemtikoForm[K]
  ) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  function validate(f: ParapemtikoForm) {
    if (!f.title.trim()) return "Ο τίτλος είναι υποχρεωτικός.";
    if (!f.doc_opinion_id)
      return "Πρέπει να επιλέξεις Γνωμάτευση (doc_opinion).";
    if (!f.start_date) return "Η ημ/νία έναρξης είναι υποχρεωτική.";
    if (!f.status.trim()) return "Το status είναι υποχρεωτικό.";
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
          .from("parapemtiko")
          .insert(payload)
          .select(PARAP_SELECT)
          .single();

        if (error) throw error;

        setRows((prev) => [inserted as ParapemtikoRow, ...prev]);
        setTotal((t) => t + 1);
        setPage(1);

        closeModal();
        fetchParapemtika(tenantId, 1, query);
      } else {
        const payload = formToDb(form);

        const { data: updated, error } = await supabase
          .from("parapemtiko")
          .update(payload)
          .eq("tenant_id", tenantId)
          .eq("id", editing.id)
          .select(PARAP_SELECT)
          .single();

        if (error) throw error;

        setRows((prev) =>
          prev.map((x) =>
            x.id === editing.id ? (updated as ParapemtikoRow) : x
          )
        );

        closeModal();
        fetchParapemtika(tenantId, page, query);
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
    if (!tenantId || !deleteRow) return;
    setDeleting(true);
    setError(null);

    try {
      const { error } = await supabase
        .from("parapemtiko")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("id", deleteRow.id);

      if (error) throw error;

      const newTotal = Math.max(0, total - 1);
      const newTotalPages = Math.max(1, Math.ceil(newTotal / PAGE_SIZE));
      const nextPage = Math.min(page, newTotalPages);
      setPage(nextPage);

      closeDelete();
      fetchParapemtika(tenantId, nextPage, query);
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
            placeholder="Αναζήτηση (τίτλος, κωδικοί, status...)"
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
        entityLabel="παραπεμπτικά"
        busy={bulkDeleting}
        onConfirm={bulkDelete}
        onClose={() => setBulkDeleteOpen(false)}
      />

      {/* Create / Edit Modal */}
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
            <input
              className="input"
              value={form.title}
              onChange={(e) => setField("title", e.target.value)}
            />
          </div>

          <div className="md:col-span-2">
            <div className="mb-1 text-xs text-muted">
              Γνωμάτευση (doc_opinion) *
            </div>
            <select
              className="input"
              value={form.doc_opinion_id}
              onChange={(e) => setField("doc_opinion_id", e.target.value)}
            >
              <option value="">— Επιλογή —</option>
              {docOpinions.map((d) => {
                const fullName =
                  d.student?.lastname || d.student?.name
                    ? `${d.student?.lastname ?? ""} ${d.student?.name ?? ""}`.trim()
                    : d.student_id;

                return (
                  <option key={d.id} value={d.id}>
                    {fullName} — {d.start_date} → {d.end_date ?? "…"}
                  </option>
                );
              })}
            </select>

            <div className="mt-1 text-[11px] text-muted">
              (Μετά το κάνουμε join με students για ονοματεπώνυμο.)
            </div>
          </div>

          <div>
            <div className="mb-1 text-xs text-muted">Κωδικός</div>
            <input
              className="input"
              value={form.code}
              onChange={(e) => setField("code", e.target.value)}
            />
          </div>

          <div>
            <div className="mb-1 text-xs text-muted">Κωδ. Διάγνωσης</div>
            <input
              className="input"
              value={form.code_diagnosis}
              onChange={(e) => setField("code_diagnosis", e.target.value)}
            />
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

          <div>
            <div className="mb-1 text-xs text-muted">Status *</div>
            <input
              className="input"
              value={form.status}
              onChange={(e) => setField("status", e.target.value)}
              placeholder="π.χ. active"
            />
            <div className="mt-1 text-[11px] text-muted">
              Αν το enum σου έχει συγκεκριμένες τιμές, εδώ το κάνουμε select.
            </div>
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
      </ParapemptikoModal>

      {/* Delete confirm */}
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

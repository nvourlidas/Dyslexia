// src/pages/TeachersPage.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/auth/AuthProvider";
import { Sheet, FileText, Trash2 } from "lucide-react";
import { callFunction } from "@/lib/api";

import TeachersTable from "@/components/teachers/TeacherTable";
import TeacherCreateEditModal from "@/components/teachers/TeacherCreateEditModal";
import StudentsColumnsDropdown from "@/components/students/StudentsColumnsDropdown";
import ToastHost from "@/components/ui/ToastHost";
import BulkDeleteConfirmModal from "@/components/ui/BulkDeleteConfirmModal";

import { useToast } from "@/hooks/useToast";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";

import { formatDateDMY, toForm, formToDb } from "@/lib/teacher.utils";

import type { TeacherRow, TeacherForm, TeacherColumnKey } from "@/types/teacher";

import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { registerNotoSansFonts } from "@/lib/pdfFonts";
import notoSansUrl from "@/assets/fonts/NotoSans-Regular.ttf?url";
import notoSansBoldUrl from "@/assets/fonts/NotoSans-Bold.ttf?url";

const ALL_COLUMNS: { key: TeacherColumnKey; label: string }[] = [
  { key: "phone", label: "Τηλέφωνο" },
  { key: "email", label: "Email" },
  { key: "idikotita", label: "Ιδικότητα" },
  { key: "active", label: "Κατάσταση" },
  { key: "created_at", label: "Ημ. Δημιουργίας" },
];

const DEFAULT_VISIBLE: TeacherColumnKey[] = ["phone", "idikotita", "created_at"];

const TEACHER_SELECT =
  "id,tenant_id,name,last_name,phone,email,idikotita,active,created_at,updated_at";

export default function TeachersPage() {
  const { profile, profileLoading } = useAuth();
  const tenantId = profile?.tenant_id ?? null;

  const [rows, setRows] = useState<TeacherRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  const { toasts, pushToast, dismissToast } = useToast();

  const [showCreate, setShowCreate] = useState(false);
  const [editRow, setEditRow] = useState<TeacherRow | null>(null);

  const allColumnKeys = useMemo(
    () => ALL_COLUMNS.map((c) => c.key) as TeacherColumnKey[],
    [],
  );

  const { visibleCols, isColVisible, toggleCol, setAllCols, resetCols } =
    useColumnVisibility<TeacherColumnKey>({
      allKeys: allColumnKeys,
      defaultVisible: DEFAULT_VISIBLE,
      storageKeyBase: "teachers_table_visible_cols_v1",
      tenantId,
    });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const toggleSelect = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  const clearSelection = () => setSelectedIds([]);

  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  async function bulkDelete() {
    if (!tenantId || selectedIds.length === 0) return;
    setBulkDeleting(true);
    try {
      await callFunction("teacher-bulk-delete", { ids: selectedIds });
      pushToast({ variant: "success", title: `Διαγράφηκαν ${selectedIds.length} εκπαιδευτικοί` });
      clearSelection();
      setBulkDeleteOpen(false);
      await load();
    } catch (e: any) {
      pushToast({ variant: "error", title: "Σφάλμα διαγραφής", message: e?.message });
    } finally {
      setBulkDeleting(false);
    }
  }

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // ── load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (profileLoading) return;
    if (!tenantId) return;
    load();
  }, [profileLoading, tenantId]);

  async function load() {
    if (!tenantId) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("teacher")
      .select(TEACHER_SELECT)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) {
      setRows([]);
      setSelectedIds([]);
      setLoading(false);
      pushToast({
        variant: "error",
        title: "Αποτυχία φόρτωσης εκπαιδευτικών",
        message: error.message,
      });
      return;
    }

    setRows((data as TeacherRow[]) ?? []);
    setSelectedIds([]);
    setLoading(false);
  }

  // ── filter / paginate ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!q) return rows;
    const needle = q.toLowerCase();
    return rows.filter((r) => {
      const full = `${r.last_name ?? ""} ${r.name ?? ""}`.trim().toLowerCase();
      return (
        full.includes(needle) ||
        (r.phone ?? "").toLowerCase().includes(needle) ||
        (r.email ?? "").toLowerCase().includes(needle) ||
        (r.idikotita ?? "").toLowerCase().includes(needle) ||
        r.id.toLowerCase().includes(needle)
      );
    });
  }, [rows, q]);

  useEffect(() => setPage(1), [q, pageSize]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const startIdx = filtered.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIdx = Math.min(filtered.length, page * pageSize);

  const pageIds = paginated.map((t) => t.id);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));

  const toggleSelectPage = () => {
    setSelectedIds((prev) => {
      if (allPageSelected) return prev.filter((id) => !pageIds.includes(id));
      return [...prev, ...pageIds.filter((id) => !prev.includes(id))];
    });
  };

  const exportRows = useMemo(() => {
    if (selectedIds.length > 0) return rows.filter((t) => selectedIds.includes(t.id));
    return filtered;
  }, [rows, filtered, selectedIds]);

  // ── exports ────────────────────────────────────────────────────────────────
  function exportExcel() {
    const data = exportRows.map((t) => ({
      Επώνυμο: t.last_name ?? "",
      Όνομα: t.name ?? "",
      Τηλέφωνο: t.phone ?? "",
      Email: t.email ?? "",
      Ιδικότητα: t.idikotita ?? "",
      Κατάσταση: t.active ? "Ενεργός" : "Ανενεργός",
      "Ημ. Δημιουργίας": formatDateDMY(t.created_at),
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Teachers");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, `teachers_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  async function exportPdf() {
    const doc = new jsPDF({ orientation: "landscape" });
    await registerNotoSansFonts(doc, notoSansUrl, notoSansBoldUrl);
    doc.setFont("NotoSans", "normal");
    doc.setFontSize(14);
    doc.text(`Εκπαιδευτικοί (${exportRows.length})`, 14, 14);

    autoTable(doc, {
      head: [["Επώνυμο", "Όνομα", "Τηλέφωνο", "Email", "Ιδικότητα", "Κατάσταση", "Ημ. Δημιουργίας"]],
      body: exportRows.map((t) => [
        t.last_name ?? "",
        t.name ?? "",
        t.phone ?? "",
        t.email ?? "",
        t.idikotita ?? "",
        t.active ? "Ενεργός" : "Ανενεργός",
        formatDateDMY(t.created_at),
      ]),
      startY: 20,
      styles: { font: "NotoSans", fontStyle: "normal", fontSize: 9, cellPadding: 2 },
      headStyles: { font: "NotoSans", fontStyle: "bold" },
      theme: "grid",
    });

    doc.save(`teachers_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  // ── create / edit ──────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditRow(null);
    setShowCreate(true);
  };

  const openEdit = (r: TeacherRow) => {
    setEditRow(r);
    setShowCreate(true);
  };

  const validate = (f: TeacherForm) => {
    if (!f.name.trim()) return "Το όνομα είναι υποχρεωτικό.";
    if (!f.last_name.trim()) return "Το επώνυμο είναι υποχρεωτικό.";
    return null;
  };

  const save = async (f: TeacherForm) => {
    if (!tenantId) {
      pushToast({ variant: "error", title: "Σφάλμα", message: "Δεν βρέθηκε tenant." });
      return;
    }

    const v = validate(f);
    if (v) {
      pushToast({ variant: "error", title: "Σφάλμα", message: v });
      return;
    }

    setBusy(true);

    try {
      if (!editRow) {
        // ✅ CREATE via edge function
        const res = await callFunction<{ id: string }>("teacher-create", {
          ...formToDb(f),
        });

        pushToast({
          variant: "success",
          title: "Ο εκπαιδευτικός δημιουργήθηκε",
          message: res?.id ? `ID: ${res.id}` : undefined,
        });
      } else {
        // ✅ UPDATE via edge function
        await callFunction<void>("teacher-update", {
          id: editRow.id,
          ...formToDb(f),
        });

        pushToast({ variant: "success", title: "Οι αλλαγές αποθηκεύτηκαν" });
      }

      setShowCreate(false);
      setEditRow(null);
      await load();
    } catch (e: any) {
      const code = e?.code as string | undefined;

      if (code === "SUBSCRIPTION_INACTIVE") {
        pushToast({
          variant: "error",
          title: "Η συνδρομή δεν είναι ενεργή",
          message: e?.message ?? "Απαιτείται ενεργή συνδρομή.",
        });
        return;
      }

      pushToast({
        variant: "error",
        title: "Αποτυχία αποθήκευσης",
        message: e?.message ?? "Unknown error",
      });
    } finally {
      setBusy(false);
    }
  };

  const desktopColCount =
    2 + // checkbox + fullname
    visibleCols.length +
    1; // actions

  const initialForm = useMemo(() => toForm(editRow), [editRow]);

  return (
    <div className="min-h-full w-full p-3 sm:p-4 md:p-6">
      <ToastHost toasts={toasts} dismiss={dismissToast} />

      <div className="flex flex-wrap justify-between">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            className="h-9 w-full rounded-md border border-border/10 bg-panel2 px-3 text-sm placeholder:text-muted sm:w-64"
            placeholder="Αναζήτηση εκπαιδευτικών…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <button
            className="h-9 rounded-md px-3 text-sm bg-primary hover:bg-primary/90 text-white cursor-pointer"
            onClick={openCreate}
          >
            Νέος Εκπαιδευτικός
          </button>

          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="text-xs text-text">
                Επιλεγμένοι:{" "}
                <span className="font-semibold">{selectedIds.length}</span>{" "}
                <button type="button" className="underline ml-1" onClick={clearSelection}>
                  (καθαρισμός)
                </button>
              </div>
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

        <div className="relative flex items-center gap-2">
          <StudentsColumnsDropdown
            columns={ALL_COLUMNS}
            isColVisible={isColVisible}
            toggleCol={toggleCol}
            setAllCols={setAllCols}
            resetCols={resetCols}
          />
        </div>
      </div>

      {/* exports */}
      <div className="mb-2 flex flex-wrap gap-2">
        <button
          className="h-9 rounded-md px-3 text-sm border border-border/15 inline-flex items-center gap-2 text-text-primary hover:bg-[#26a347] hover:border-white/15 hover:text-white cursor-pointer"
          onClick={exportExcel}
          disabled={loading || rows.length === 0}
          title="Export Excel"
        >
          <Sheet className="h-4 w-4" />
          Εξαγωγή Excel
        </button>

        <button
          className="h-9 rounded-md px-3 text-sm border border-border/15 inline-flex items-center gap-2 text-text-primary hover:bg-[#db2525] hover:border-white/15 hover:text-white cursor-pointer"
          onClick={exportPdf}
          disabled={loading || rows.length === 0}
          title="Export PDF"
        >
          <FileText className="h-4 w-4" />
          Εξαγωγή PDF
        </button>
      </div>

      <TeachersTable
        tenantId={tenantId}
        loading={loading}
        filteredLength={filtered.length}
        paginated={paginated}
        desktopColCount={desktopColCount}
        isColVisible={isColVisible}
        selectedIds={selectedIds}
        toggleSelect={toggleSelect}
        clearSelection={clearSelection}
        allPageSelected={allPageSelected}
        toggleSelectPage={toggleSelectPage}
        startIdx={startIdx}
        endIdx={endIdx}
        page={page}
        pageCount={pageCount}
        pageSize={pageSize}
        setPage={setPage}
        setPageSize={setPageSize}
        onEdit={openEdit}
        onDeleted={load}
        formatDateDMY={formatDateDMY}
      />

      <BulkDeleteConfirmModal
        open={bulkDeleteOpen}
        count={selectedIds.length}
        entityLabel="εκπαιδευτικούς"
        busy={bulkDeleting}
        onConfirm={bulkDelete}
        onClose={() => setBulkDeleteOpen(false)}
      />

      <TeacherCreateEditModal
        open={showCreate}
        busy={busy}
        title={editRow ? "Επεξεργασία Εκπαιδευτικού" : "Νέος Εκπαιδευτικός"}
        initialForm={initialForm}
        onClose={() => {
          if (busy) return;
          setShowCreate(false);
          setEditRow(null);
        }}
        onSave={save}
      />
    </div>
  );
}

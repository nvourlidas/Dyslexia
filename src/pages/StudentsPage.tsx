// src/pages/StudentsPage.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/auth/AuthProvider";
import { Sheet, FileText } from "lucide-react";
import StudentsTable from "@/components/students/StudentsTable";
import ToastHost from "@/components/ui/ToastHost";
import StudentCreateEditModal from "@/components/students/StudentCreateEditModal";
import StudentsColumnsDropdown from "@/components/students/StudentsColumnsDropdown";

import { callFunction } from "@/lib/api";

import { useToast } from "@/hooks/useToast";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";

import { formatDateDMY, toForm, formToDb } from "@/lib/student.utils";

import {
  buildStudentExportColumns,
  studentToExportObject,
} from "@/lib/student.export";

import type {
  StudentRow,
  StudentForm,
  ColumnKey,
} from "@/types/student";

import { registerNotoSansFonts } from "@/lib/pdfFonts";

import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ✅ Greek-capable fonts
import notoSansUrl from "@/assets/fonts/NotoSans-Regular.ttf?url";
import notoSansBoldUrl from "@/assets/fonts/NotoSans-Bold.ttf?url";





const ALL_COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "email", label: "Email" },
  { key: "birthdate", label: "Ημ. Γέννησης" },
  { key: "city", label: "Πόλη" },
  { key: "address", label: "Διεύθυνση" },
  { key: "amka", label: "ΑΜΚΑ" },
  { key: "gender", label: "Φύλο" },
  { key: "parent_name", label: "Γονέας" },
  { key: "parent_phone1", label: "Τηλ. Γονέα 1" },
  { key: "parent_phone2", label: "Τηλ. Γονέα 2" },
  { key: "doctor_visit", label: "Επίσκεψη Γιατρού" },
  { key: "doctor_name", label: "Γιατρός" },
  { key: "created_at", label: "Ημ. Δημιουργίας" },
];

const DEFAULT_VISIBLE: ColumnKey[] = ["amka", "city", "created_at"];



export default function StudentsPage() {
  const { profile, profileLoading } = useAuth();
  const tenantId = profile?.tenant_id ?? null;

  useEffect(() => {
    if (profileLoading) return;
    if (!tenantId) return;
    load(); // uses tenantId
  }, [profileLoading, tenantId]);

  const [rows, setRows] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const { toasts, pushToast, dismissToast } = useToast();

  // Create/Edit modal
  const [showCreate, setShowCreate] = useState(false);
  const [editRow, setEditRow] = useState<StudentRow | null>(null);



  const allColumnKeys = useMemo(() => ALL_COLUMNS.map((c) => c.key) as ColumnKey[], []);

  const {
    visibleCols,
    isColVisible,
    toggleCol,
    setAllCols,
    resetCols,
  } = useColumnVisibility<ColumnKey>({
    allKeys: allColumnKeys,
    defaultVisible: DEFAULT_VISIBLE,
    storageKeyBase: "students_table_visible_cols_v1",
    tenantId,
  });


  // selection + pagination (same behavior as MembersPage)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const toggleSelect = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  const clearSelection = () => setSelectedIds([]);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);



  const STUDENT_SELECT =
    "user_id,tenant_id,name,lastname,amka,gender,birthdate,address,city,phone,email,parent_name,parent_phone1,parent_phone2,active,doctor_visit,doctor_name,created_at,updated_at";

  async function load() {
    if (!tenantId) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("students")
      .select(STUDENT_SELECT)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setRows([]);
      setSelectedIds([]);
      setLoading(false);
      pushToast({
        variant: "error",
        title: "Αποτυχία φόρτωσης μαθητών",
        message: error.message,
      });
      return;
    }

    setRows((data as StudentRow[]) ?? []);
    setSelectedIds([]);
    setLoading(false);
  }


  const filtered = useMemo(() => {
    if (!q) return rows;
    const needle = q.toLowerCase();
    return rows.filter((r) => {
      const full = `${r.lastname ?? ""} ${r.name ?? ""}`.trim().toLowerCase();
      return (
        full.includes(needle) ||
        (r.phone ?? "").toLowerCase().includes(needle) ||
        (r.email ?? "").toLowerCase().includes(needle) ||
        (r.amka ?? "").toLowerCase().includes(needle) ||
        (r.city ?? "").toLowerCase().includes(needle) ||
        r.user_id.toLowerCase().includes(needle)
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

  const pageIds = paginated.map((s) => s.user_id);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));

  const toggleSelectPage = () => {
    setSelectedIds((prev) => {
      if (allPageSelected) return prev.filter((id) => !pageIds.includes(id));
      return [...prev, ...pageIds.filter((id) => !prev.includes(id))];
    });
  };

  // export (same logic)
  const exportRows = useMemo(() => {
    if (selectedIds.length > 0) {
      return rows.filter((s) => selectedIds.includes(s.user_id));
    }
    return filtered;
  }, [rows, filtered, selectedIds]);


  function exportExcel() {
    const cols = buildStudentExportColumns(visibleCols);
    const data = exportRows.map((s) => {
      const obj = studentToExportObject(s);
      const out: Record<string, any> = {};
      cols.forEach((c) => (out[c.label] = (obj as any)[c.key]));
      return out;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");

    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const filename = `students_${new Date().toISOString().slice(0, 10)}.xlsx`;
    saveAs(blob, filename);
  }


  async function exportPdf() {
    const cols = buildStudentExportColumns(visibleCols);
    const doc = new jsPDF({ orientation: "landscape" });

    await registerNotoSansFonts(doc, notoSansUrl, notoSansBoldUrl);

    doc.setFont("NotoSans", "normal");
    doc.setFontSize(14);
    doc.text(`Μαθητές (${exportRows.length})`, 14, 14);

    const head = [cols.map((c) => c.label)];
    const body = exportRows.map((s) => {
      const obj = studentToExportObject(s);
      return cols.map((c) => String((obj as any)[c.key] ?? ""));
    });

    autoTable(doc, {
      head,
      body,
      startY: 20,
      styles: { font: "NotoSans", fontStyle: "normal", fontSize: 9, cellPadding: 2 },
      headStyles: { font: "NotoSans", fontStyle: "bold" },
      theme: "grid",
    });

    doc.save(`students_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  // create/edit modal submit
  const [busy, setBusy] = useState(false);

  const openCreate = () => {
    setEditRow(null);
    setShowCreate(true);
  };

  const openEdit = (r: StudentRow) => {
    setEditRow(r);
    setShowCreate(true);
  };

  const validate = (f: StudentForm) => {
    if (!f.name.trim()) return "Το όνομα είναι υποχρεωτικό.";
    if (!f.lastname.trim()) return "Το επώνυμο είναι υποχρεωτικό.";
    return null;
  };


  const save = async (f: StudentForm) => {
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
        // ✅ CREATE
        const payload = {
          tenant_id: tenantId,
          ...formToDb(f),
        };

        const res = await callFunction<{ id: string }>("student-create", payload);

        pushToast({
          variant: "success",
          title: "Ο μαθητής δημιουργήθηκε",
          message: res?.id ? `ID: ${res.id}` : undefined,
        });
      } else {
        // ✅ UPDATE
        const payload = {
          tenant_id: tenantId,
          user_id: editRow.user_id,
          ...formToDb(f),
        };

        await callFunction<void>("student-update", payload);

        pushToast({
          variant: "success",
          title: "Οι αλλαγές αποθηκεύτηκαν",
        });
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
    3 + // checkbox + fullname + phone
    visibleCols.length +
    1; // actions

  const initialForm = useMemo(() => toForm(editRow), [editRow]);

  return (
    <div className="min-h-full w-full p-6">
      <ToastHost toasts={toasts} dismiss={dismissToast} />

      <div className="flex flex-wrap justify-between">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            className="h-9 rounded-md border border-border/10 bg-panel2 px-3 text-sm placeholder:text-muted"
            placeholder="Αναζήτηση μαθητών…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <button
            className="h-9 rounded-md px-3 text-sm bg-primary hover:bg-primary/90 text-white cursor-pointer"
            onClick={openCreate}
          >
            Νέος Μαθητής
          </button>

          {selectedIds.length > 0 && (
            <div className="text-xs text-text">
              Επιλεγμένοι μαθητές:{" "}
              <span className="font-semibold">{selectedIds.length}</span>{" "}
              <button type="button" className="underline ml-1" onClick={clearSelection}>
                (καθαρισμός)
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

      {/* exports (same UI as MembersPage) */}
      <div className="mb-2 flex gap-2">
        <button
          className="h-9 rounded-md px-3 text-sm border border-border/15 inline-flex items-center gap-2 text-text-primary hover:bg-[#26a347] hover:border-white/15 hover:text-white cursor-pointer"
          onClick={() => exportExcel()}
          disabled={loading || rows.length === 0}
          title="Export Excel"
        >
          <Sheet className="h-4 w-4" />
          Εξαγωγή Excel
        </button>

        <button
          className="h-9 rounded-md px-3 text-sm border border-border/15 inline-flex items-center gap-2 text-text-primary hover:bg-[#db2525] hover:border-white/15 hover:text-white cursor-pointer"
          onClick={() => exportPdf()}
          disabled={loading || rows.length === 0}
          title="Export PDF"
        >
          <FileText className="h-4 w-4" />
          Εξαγωγή PDF
        </button>
      </div>

      <StudentsTable
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

      {/* Create/Edit modal */}
      <StudentCreateEditModal
        open={showCreate}
        busy={busy}
        title={editRow ? "Επεξεργασία Μαθητή" : "Νέος Μαθητής"}
        initialForm={initialForm}
        onClose={() => {
          if (busy) return;
          setShowCreate(false);
          setEditRow(null);
        }}
        onSave={(f) => save(f)}
      />
    </div>
  );
}

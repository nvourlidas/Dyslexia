// src/pages/Dashboard.tsx
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PencilRuler } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/auth/AuthProvider";
import NotepadSection from "@/components/dashboard/NotepadSection"
import DoctorListModal from "@/components/dashboard/DoctorListModal"
import DocOpinionSendModal from "@/components/dashboard/DocOpinionSendModal"
import ParapemtikaExpiringModal from "@/components/dashboard/ParapemtikaExpiringModal";
import DashboardGrid from "@/components/dashboard/DashboardGrid";
import { useDashboardLayout } from "@/hooks/useDashboardLayout";
import type { WidgetId } from "@/hooks/useDashboardLayout";

type Kpis = {
  activeStudents: number;
  activeTeachers: number;
  todaySessions: number;
  expiringParapemtika30: number;
  missingCodeParapemtika: number;
};

type ExpiringParapemtikoRow = {
  id: string;
  title: string;
  end_date: string | null;
  status: string;
  doc_opinion_id: string;
};

type ExpiringParapemtikoDetails = {
  id: string;
  title: string;
  code: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  student_name: string; // "Όνομα Επώνυμο"
  doc_opinion_id: string;
};

type DocOpinionDetail = {
  id: string;
  student_id: string;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
};

async function getMyTenantId(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", userId)
    .single();

  if (error || !data?.tenant_id) throw new Error("Δεν βρέθηκε tenant για τον χρήστη.");
  return data.tenant_id as string;
}

function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
function startOfTomorrowIso() {
  const d = new Date();
  d.setHours(24, 0, 0, 0);
  return d.toISOString();
}
function plusDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export default function Dashboard() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    layout,
    isEditing,
    startEdit,
    cancelEdit,
    saveEdit,
    moveRow,
    setWidget,
    swapCells,
    addColumn,
    removeColumn,
    addRow,
    removeRow,
  } = useDashboardLayout();

  // Enter edit mode when ?edit=1 appears in the URL (works even if already on dashboard)
  useEffect(() => {
    if (searchParams.get("edit") === "1") {
      startEdit();
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [kpis, setKpis] = useState<Kpis>({
    activeStudents: 0,
    activeTeachers: 0,
    todaySessions: 0,
    expiringParapemtika30: 0,
    missingCodeParapemtika: 0,
  });

  const [expiringRows, setExpiringRows] = useState<ExpiringParapemtikoRow[]>([]);

  // Doctor list modal state
  const [showDoctorModal, setShowDoctorModal] = useState(false)
  const [doctorListCount, setDoctorListCount] = useState(0)

  // Doc opinion send modal state
  const [showDocOpinionModal, setShowDocOpinionModal] = useState(false)
  const [docOpinionCount, setDocOpinionCount] = useState(0)

  // Parapemtika expiring modal state
  const [showParapemtikaModal, setShowParapemtikaModal] = useState(false)
  const [parapemtikaCount, setParapemtikaCount] = useState(0)

  // Modal state
  const [showExpiringModal, setShowExpiringModal] = useState(false);
  const [expiringDetails, setExpiringDetails] = useState<ExpiringParapemtikoDetails[]>([]);
  const [expiringModalLoading, setExpiringModalLoading] = useState(false);
  const [expiringModalErr, setExpiringModalErr] = useState<string | null>(null);

  const [selectedParapemtiko, setSelectedParapemtiko] =
  useState<ExpiringParapemtikoDetails | null>(null);

const [showParapemtikoDetail, setShowParapemtikoDetail] = useState(false);
const [docOpinionDetail, setDocOpinionDetail] = useState<DocOpinionDetail | null>(null);
const [detailLoading, setDetailLoading] = useState(false);
const [detailErr, setDetailErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      if (!user?.id) return;
      try {
        const tid = await getMyTenantId(user.id);
        if (!cancelled) setTenantId(tid);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Σφάλμα tenant.");
      }
    }
    boot();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!tenantId) return;
      setLoading(true);
      setErr(null);

      const todayStart = startOfTodayIso();
      const tomorrowStart = startOfTomorrowIso();
      const in30Days = plusDaysIso(30);

      try {
        // 1) Students KPI
        const studentsReq = supabase
          .from("students")
          .select("user_id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .eq("active", true);

        // 2) Teachers KPI
        const teachersReq = supabase
          .from("teacher")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .eq("active", true);

        // 3) Sessions today KPI
        const sessionsReq = supabase
          .from("class_sessions")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .gte("starts_at", todayStart)
          .lt("starts_at", tomorrowStart);

        // 4) Expiring parapemtika (count + list)
        const expiringCountReq = supabase
          .from("parapemtiko")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .eq("status", "active")
          .not("end_date", "is", null)
          .gte("end_date", todayStart.slice(0, 10)) // date column safety (YYYY-MM-DD)
          .lte("end_date", in30Days.slice(0, 10));

        const expiringListReq = supabase
          .from("parapemtiko")
          .select("id,title,end_date,status,doc_opinion_id")
          .eq("tenant_id", tenantId)
          .eq("status", "active")
          .not("end_date", "is", null)
          .gte("end_date", todayStart.slice(0, 10))
          .lte("end_date", in30Days.slice(0, 10))
          .order("end_date", { ascending: true })
          .limit(8);

        // 5) Missing code parapemtika
        const missingCodeReq = supabase
          .from("parapemtiko")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .eq("status", "active")
          .or("code.is.null,code.eq.");

        // 6) Parapemtika pending count (all pending, no date filter)
        const parapemtikaCountReq = supabase
          .from("parapemtiko")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .eq("status", "pending")

        // 7) Doc opinion send: pending, expiring within 4 calendar months
        const in2MonthsStr = new Date(
          new Date().getFullYear(),
          new Date().getMonth() + 4,
          new Date().getDate(),
        ).toISOString().slice(0, 10)

        const docOpinionCountReq = supabase
          .from("doc_opinion")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
          .not("end_date", "is", null)
          .gte("end_date", todayStart.slice(0, 10))
          .lte("end_date", in2MonthsStr)

        // 7) Doctor list: students without doctor_visit, minus dismissed
        const doctorStudentsReq = supabase
          .from("students")
          .select("user_id")
          .eq("tenant_id", tenantId)
          .eq("doctor_visit", false);

        const doctorDismissedReq = supabase
          .from("dashboard_doctor_dismissed")
          .select("student_id")
          .eq("tenant_id", tenantId);

        const [
          studentsRes,
          teachersRes,
          sessionsRes,
          expCountRes,
          expListRes,
          missingCodeRes,
          parapemtikaCountRes,
          docOpinionCountRes,
          doctorStudentsRes,
          doctorDismissedRes,
        ] = await Promise.all([
          studentsReq,
          teachersReq,
          sessionsReq,
          expiringCountReq,
          expiringListReq,
          missingCodeReq,
          parapemtikaCountReq,
          docOpinionCountReq,
          doctorStudentsReq,
          doctorDismissedReq,
        ]);

        const firstErr =
          studentsRes.error ??
          teachersRes.error ??
          sessionsRes.error ??
          expCountRes.error ??
          expListRes.error ??
          missingCodeRes.error;

        if (firstErr) throw firstErr;

        if (cancelled) return;

        setKpis({
          activeStudents: studentsRes.count ?? 0,
          activeTeachers: teachersRes.count ?? 0,
          todaySessions: sessionsRes.count ?? 0,
          expiringParapemtika30: expCountRes.count ?? 0,
          missingCodeParapemtika: missingCodeRes.count ?? 0,
        });

        setExpiringRows((expListRes.data ?? []) as ExpiringParapemtikoRow[]);

        if (!parapemtikaCountRes.error) {
          if (!cancelled) setParapemtikaCount(parapemtikaCountRes.count ?? 0)
        }

        if (!docOpinionCountRes.error) {
          if (!cancelled) setDocOpinionCount(docOpinionCountRes.count ?? 0)
        }

        if (!doctorStudentsRes.error && !doctorDismissedRes.error) {
          const dismissedIds = new Set((doctorDismissedRes.data ?? []).map((r: any) => r.student_id));
          const doctorCount = (doctorStudentsRes.data ?? []).filter((r: any) => !dismissedIds.has(r.user_id)).length;
          if (!cancelled) setDoctorListCount(doctorCount);
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Σφάλμα φόρτωσης dashboard.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  // Load modal details when modal opens
  useEffect(() => {
    let cancelled = false;

    async function loadExpiringDetails() {
      if (!tenantId) return;
      if (!showExpiringModal) return;

      setExpiringModalLoading(true);
      setExpiringModalErr(null);

      const todayStart = startOfTodayIso();
      const in30Days = plusDaysIso(30);

      try {
        // 1) fetch parapemtika that expire soon
        const { data: pData, error: pErr } = await supabase
          .from("parapemtiko")
          .select("id,title,code,start_date,end_date,status,doc_opinion_id")
          .eq("tenant_id", tenantId)
          .eq("status", "active")
          .not("end_date", "is", null)
          .gte("end_date", todayStart.slice(0, 10))
          .lte("end_date", in30Days.slice(0, 10))
          .order("end_date", { ascending: true })
          .limit(200);

        if (pErr) throw pErr;

        const parapemtika = (pData ?? []) as Array<{
          id: string;
          title: string;
          code: string | null;
          start_date: string | null;
          end_date: string | null;
          status: string;
          doc_opinion_id: string;
        }>;

        // 2) map doc_opinion_id -> student_id
        const docOpinionIds = parapemtika.map((x) => x.doc_opinion_id).filter(Boolean);

        const { data: dData, error: dErr } = await supabase
          .from("doc_opinion")
          .select("id,student_id")
          .in("id", docOpinionIds);

        if (dErr) throw dErr;

        const docToStudent = new Map<string, string>();
        (dData ?? []).forEach((r: any) => {
          if (r?.id && r?.student_id) docToStudent.set(r.id, r.student_id);
        });

        // 3) map student_id -> full name
        const studentIds = Array.from(new Set(Array.from(docToStudent.values())));

        const { data: sData, error: sErr } = await supabase
          .from("students")
          .select("user_id,name,lastname")
          .in("user_id", studentIds);

        if (sErr) throw sErr;

        const studentNameById = new Map<string, string>();
        (sData ?? []).forEach((s: any) => {
          const full = `${s?.name ?? ""} ${s?.lastname ?? ""}`.trim() || "(Χωρίς όνομα)";
          if (s?.user_id) studentNameById.set(s.user_id, full);
        });

        const details: ExpiringParapemtikoDetails[] = parapemtika.map((p) => {
          const studentId = docToStudent.get(p.doc_opinion_id) ?? "";
          const studentName = studentNameById.get(studentId) ?? "(Άγνωστος μαθητής)";

          return {
            ...p,
            student_name: studentName,
          };
        });

        if (!cancelled) setExpiringDetails(details);
      } catch (e: any) {
        if (!cancelled) setExpiringModalErr(e?.message ?? "Σφάλμα φόρτωσης παραπεμπτικών.");
      } finally {
        if (!cancelled) setExpiringModalLoading(false);
      }
    }

    loadExpiringDetails();
    return () => {
      cancelled = true;
    };
  }, [showExpiringModal, tenantId]);

  useEffect(() => {
  let cancelled = false;

  async function loadDetail() {
    if (!showParapemtikoDetail) return;
    if (!selectedParapemtiko?.doc_opinion_id) return;

    setDetailLoading(true);
    setDetailErr(null);

    try {
      const { data, error } = await supabase
        .from("doc_opinion")
        .select("id,student_id,start_date,end_date,notes")
        .eq("id", selectedParapemtiko.doc_opinion_id)
        .single();

      if (error) throw error;

      if (!cancelled) setDocOpinionDetail(data as DocOpinionDetail);
    } catch (e: any) {
      if (!cancelled) setDetailErr(e?.message ?? "Σφάλμα φόρτωσης λεπτομερειών.");
    } finally {
      if (!cancelled) setDetailLoading(false);
    }
  }

  loadDetail();
  return () => {
    cancelled = true;
  };
}, [showParapemtikoDetail, selectedParapemtiko?.doc_opinion_id]);

  const pendingItems = useMemo(() => {
    return [
      {
        key: "expiring30",
        title: "Παραπεμπτικά προς λήξη (30 μέρες)",
        value: kpis.expiringParapemtika30,
      },
      {
        key: "missingCode",
        title: "Παραπεμπτικά χωρίς κωδικό",
        value: kpis.missingCodeParapemtika,
      },
    ];
  }, [kpis.expiringParapemtika30, kpis.missingCodeParapemtika]);

  function renderWidget(widgetId: WidgetId | null) {
    if (!widgetId) return null;

    if (widgetId === "kpi_students") {
      return (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setShowDoctorModal(true)}
          onKeyDown={(e) => e.key === "Enter" && setShowDoctorModal(true)}
          className="rounded-2xl border border-border bg-panel px-4 py-3 cursor-pointer hover:border-primary/40 transition-colors"
        >
          <div className="text-xs text-muted">Μαθητές για γιατρό</div>
          <div className="mt-1 text-xl font-semibold">{loading ? "…" : doctorListCount}</div>
          <div className="mt-0.5 text-xs text-muted">χωρίς εγγεγραμμένο γιατρό</div>
        </div>
      );
    }
    if (widgetId === "kpi_teachers") {
      return (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setShowParapemtikaModal(true)}
          onKeyDown={(e) => e.key === "Enter" && setShowParapemtikaModal(true)}
          className="rounded-2xl border border-border bg-panel px-4 py-3 cursor-pointer hover:border-primary/40 transition-colors"
        >
          <div className="text-xs text-muted">Παραπεμπτικά προς λήξη</div>
          <div className="mt-1 text-xl font-semibold">{loading ? "…" : parapemtikaCount}</div>
          <div className="mt-0.5 text-xs text-muted">σε εκκρεμότητα</div>
        </div>
      );
    }
    if (widgetId === "kpi_sessions") {
      return <KpiCard title="Συνεδρίες Σήμερα" value={kpis.todaySessions} loading={loading} />;
    }
    if (widgetId === "kpi_expiring") {
      return (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setShowDocOpinionModal(true)}
          onKeyDown={(e) => e.key === "Enter" && setShowDocOpinionModal(true)}
          className="rounded-2xl border border-border bg-panel px-4 py-3 cursor-pointer hover:border-primary/40 transition-colors"
        >
          <div className="text-xs text-muted">Γνωματεύσεις προς αποστολή</div>
          <div className="mt-1 text-xl font-semibold">{loading ? "…" : docOpinionCount}</div>
          <div className="mt-0.5 text-xs text-muted">λήγουν εντός 4 μηνών</div>
        </div>
      );
    }

    if (widgetId === "notepad") {
      return tenantId ? <NotepadSection tenantId={tenantId} /> : null;
    }

    if (widgetId === "pending") {
      return (
        <div className="rounded-2xl border border-border bg-panel p-4">
          <div className="mb-3 text-base font-semibold">Εκκρεμότητες</div>
          <div className="space-y-2">
            {pendingItems.map((it) => {
              const clickable =
                it.key === "expiring30" && (it.value ?? 0) > 0 && !loading;
              return (
                <div
                  key={it.key}
                  onClick={() => { if (!clickable) return; setShowExpiringModal(true); }}
                  className={[
                    "flex items-center justify-between rounded-xl border border-border bg-bg px-3 py-2",
                    clickable ? "cursor-pointer hover:bg-bg/60 transition" : "",
                  ].join(" ")}
                  role={clickable ? "button" : undefined}
                  tabIndex={clickable ? 0 : -1}
                >
                  <div className="text-sm">{it.title}</div>
                  <div className="text-sm font-semibold">{loading ? "…" : it.value}</div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return null;
  }

  const editOps = { moveRow, setWidget, swapCells, addColumn, removeColumn, addRow, removeRow };

  return (
    <div className="space-y-3">
      {/* Edit mode banner */}
      {isEditing && (
        <div className="sticky top-0 z-30 -mx-3 -mt-3 sm:-mx-4 sm:-mt-4 flex items-center justify-between gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm font-medium" style={{ color: "var(--color-warning)" }}>
            <PencilRuler className="h-4 w-4" />
            Λειτουργία Επεξεργασίας Αρχικής
          </div>
          <div className="flex items-center gap-2">
            <button className="btn btn-secondary text-sm" onClick={cancelEdit}>
              Ακύρωση
            </button>
            <button className="btn btn-primary text-sm" onClick={saveEdit}>
              Αποθήκευση
            </button>
          </div>
        </div>
      )}

      {/* Minimal page title */}
      <div className="flex items-center gap-2 px-1">
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <span className="text-sm text-muted">— Σύνοψη & εκκρεμότητες</span>
      </div>

      {err && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm">
          {err}
        </div>
      )}

      {/* Layout grid (normal + edit mode) */}
      <DashboardGrid
        layout={layout}
        isEditing={isEditing}
        editOps={editOps}
        renderWidget={renderWidget}
      />

      {/* Modal: Parapemtika expiring */}
      {tenantId && (
        <ParapemtikaExpiringModal
          open={showParapemtikaModal}
          tenantId={tenantId}
          onClose={() => setShowParapemtikaModal(false)}
          onCountChange={setParapemtikaCount}
        />
      )}

      {/* Modal: Doc opinion send */}
      {tenantId && (
        <DocOpinionSendModal
          open={showDocOpinionModal}
          tenantId={tenantId}
          onClose={() => setShowDocOpinionModal(false)}
          onCountChange={setDocOpinionCount}
        />
      )}

      {/* Modal: Doctor list */}
      {tenantId && (
        <DoctorListModal
          open={showDoctorModal}
          tenantId={tenantId}
          onClose={() => setShowDoctorModal(false)}
          onCountChange={setDoctorListCount}
        />
      )}

      {/* Modal: Expiring parapemtika */}
      {showExpiringModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* overlay */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowExpiringModal(false)}
          />

          {/* modal */}
          <div className="relative z-10 w-[95vw] max-w-4xl rounded-2xl border border-border bg-panel p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">
                  Παραπεμπτικά προς λήξη (30 μέρες)
                </div>
                <div className="text-sm text-muted-foreground">
                  Αναλυτική λίστα για ενέργειες/επικοινωνία.
                </div>
              </div>
              {showParapemtikoDetail && selectedParapemtiko && (
  <div className="fixed inset-0 z-[60] flex items-center justify-center">
    <div
      className="absolute inset-0 bg-black/60"
      onClick={() => setShowParapemtikoDetail(false)}
    />

    <div className="relative z-10 w-[95vw] max-w-2xl rounded-2xl border border-border bg-panel p-4 shadow-2xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">Λεπτομέρειες Παραπεμπτικού</div>
          <div className="text-sm text-muted-foreground">
            {selectedParapemtiko.student_name}
          </div>
        </div>

        <button
          onClick={() => setShowParapemtikoDetail(false)}
          className="rounded-xl border border-border bg-bg px-3 py-1 text-sm hover:bg-bg/60"
        >
          Κλείσιμο
        </button>
      </div>

      {detailErr && (
        <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm">
          {detailErr}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3">
        {/* basic parapemtiko info */}
        <div className="rounded-xl border border-border bg-bg p-3">
          <div className="text-xs text-muted-foreground">Τίτλος</div>
          <div className="text-sm font-medium">{selectedParapemtiko.title}</div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-bg p-3">
            <div className="text-xs text-muted-foreground">Κωδικός</div>
            <div className="text-sm font-medium">{selectedParapemtiko.code || "-"}</div>
          </div>

          <div className="rounded-xl border border-border bg-bg p-3">
            <div className="text-xs text-muted-foreground">Status</div>
            <div className="text-sm font-medium">{selectedParapemtiko.status}</div>
          </div>

          <div className="rounded-xl border border-border bg-bg p-3">
            <div className="text-xs text-muted-foreground">Έναρξη</div>
            <div className="text-sm font-medium">{selectedParapemtiko.start_date || "-"}</div>
          </div>

          <div className="rounded-xl border border-border bg-bg p-3">
            <div className="text-xs text-muted-foreground">Λήξη</div>
            <div className="text-sm font-medium">{selectedParapemtiko.end_date || "-"}</div>
          </div>
        </div>

        {/* doc opinion info */}
        <div className="rounded-xl border border-border bg-bg p-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Γνωμάτευση (doc_opinion)</div>
            {detailLoading && <div className="text-xs text-muted-foreground">Φόρτωση…</div>}
          </div>

          {!detailLoading && !docOpinionDetail ? (
            <div className="mt-2 text-sm text-muted-foreground">
              Δεν βρέθηκαν επιπλέον στοιχεία.
            </div>
          ) : (
            docOpinionDetail && (
              <div className="mt-3 space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Ημ/νία έναρξης:</span>{" "}
                  {docOpinionDetail.start_date || "-"}
                </div>
                <div>
                  <span className="text-muted-foreground">Ημ/νία λήξης:</span>{" "}
                  {docOpinionDetail.end_date || "-"}
                </div>
                <div>
                  <div className="text-muted-foreground">Σημειώσεις:</div>
                  <div className="mt-1 whitespace-pre-wrap">
                    {docOpinionDetail.notes || "-"}
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  </div>
)}

              <button
                onClick={() => setShowExpiringModal(false)}
                className="rounded-xl border border-border bg-bg px-3 py-1 text-sm hover:bg-bg/60"
              >
                Κλείσιμο
              </button>
            </div>

            <div className="mt-4">
              {expiringModalErr && (
                <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm">
                  {expiringModalErr}
                </div>
              )}

              {expiringModalLoading ? (
                <div className="text-sm text-muted-foreground">Φόρτωση…</div>
              ) : expiringDetails.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  Δεν υπάρχουν παραπεμπτικά προς λήξη.
                </div>
              ) : (
                <div className="max-h-[60vh] overflow-auto rounded-xl border border-border">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-panel">
                      <tr className="border-b border-border">
                        <th className="p-3">Μαθητής</th>
                        <th className="p-3">Τίτλος</th>
                        <th className="p-3">Κωδικός</th>
                        <th className="p-3">Έναρξη</th>
                        <th className="p-3">Λήξη</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expiringDetails.map((r) => (
                        <tr
                          key={r.id}
                          className="border-b border-border hover:bg-bg/60 cursor-pointer"
                          onClick={() => {
                            setSelectedParapemtiko(r);
                            setDocOpinionDetail(null);
                            setShowParapemtikoDetail(true);
                          }}
                        >
                          <td className="p-3 font-medium">{r.student_name}</td>
                          <td className="p-3">{r.title}</td>
                          <td className="p-3">{r.code || "-"}</td>
                          <td className="p-3">{r.start_date || "-"}</td>
                          <td className="p-3">{r.end_date || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="mt-3 text-xs text-muted-foreground">
              * Στο επόμενο βήμα μπορούμε να κάνουμε click σε γραμμή και να ανοίγει “Detail modal” ανά παραπεμπτικό.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  title,
  value,
  loading,
}: {
  title: string;
  value: number;
  loading: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-panel px-4 py-3">
      <div className="text-xs text-muted">{title}</div>
      <div className="mt-1 text-xl font-semibold">{loading ? "…" : value}</div>
    </div>
  );
}
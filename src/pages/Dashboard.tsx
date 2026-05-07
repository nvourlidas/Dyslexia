// src/pages/Dashboard.tsx
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PencilRuler } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/auth/AuthProvider";
import NotepadSection from "@/components/dashboard/NotepadSection"
import DoctorListModal from "@/components/dashboard/DoctorListModal"
import DocOpinionSendModal from "@/components/dashboard/DocOpinionSendModal"
import ParapemtikaExpiringModal from "@/components/dashboard/ParapemtikaExpiringModal"
import TodaySessionsModal from "@/components/dashboard/TodaySessionsModal"
import ParapemtikaNoCodeModal from "@/components/dashboard/ParapemtikaNoCodeModal"
import ParapemtikaExecutionModal from "@/components/dashboard/ParapemtikaExecutionModal";
import ParapemtikaExpiring30Modal from "@/components/dashboard/ParapemtikaExpiring30Modal";
import DashboardGrid from "@/components/dashboard/DashboardGrid";
import { useDashboardLayout } from "@/hooks/useDashboardLayout";
import type { WidgetId } from "@/hooks/useDashboardLayout";

type Kpis = {
  activeStudents: number;
  activeTeachers: number;
  todaySessions: number;
  missingCodeParapemtika: number;
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
    missingCodeParapemtika: 0,
  });

  const [expiring30Count, setExpiring30Count] = useState(0);

  // Doctor list modal state
  const [showDoctorModal, setShowDoctorModal] = useState(false)
  const [doctorListCount, setDoctorListCount] = useState(0)

  // Doc opinion send modal state
  const [showDocOpinionModal, setShowDocOpinionModal] = useState(false)
  const [docOpinionCount, setDocOpinionCount] = useState(0)

  // Parapemtika expiring modal state
  const [showParapemtikaModal, setShowParapemtikaModal] = useState(false)
  const [parapemtikaCount, setParapemtikaCount] = useState(0)

  // Today sessions modal state
  const [showTodayModal, setShowTodayModal] = useState(false)

  // No-code parapemtika modal state
  const [showNoCodeModal, setShowNoCodeModal] = useState(false)
  const [noCodeCount, setNoCodeCount] = useState(0)

  // Execution parapemtika modal state
  const [showExecutionModal, setShowExecutionModal] = useState(false)

  // Expiring 30-day modal
  const [showExpiringModal, setShowExpiringModal] = useState(false);

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

        // 4) Expiring parapemtika within 30 days (count only — list is fetched by modal)
        const expiringCountReq = supabase
          .from("parapemtiko")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .eq("status", "pending")
          .not("end_date", "is", null)
          .gte("end_date", todayStart.slice(0, 10))
          .lte("end_date", in30Days.slice(0, 10));

        // 5) Missing code parapemtika
        const missingCodeReq = supabase
          .from("parapemtiko")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .neq("status", "completed")
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
          missingCodeRes.error;

        if (firstErr) throw firstErr;

        if (cancelled) return;

        setKpis({
          activeStudents: studentsRes.count ?? 0,
          activeTeachers: teachersRes.count ?? 0,
          todaySessions: sessionsRes.count ?? 0,
          missingCodeParapemtika: missingCodeRes.count ?? 0,
        });

        setExpiring30Count(expCountRes.count ?? 0);
        if (!cancelled) setNoCodeCount(missingCodeRes.count ?? 0);

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


  const pendingItems = useMemo(() => {
    return [
      {
        key: "expiring30",
        title: "Παραπεμπτικά προς λήξη (30 μέρες)",
        value: expiring30Count,
      },
      {
        key: "missingCode",
        title: "Παραπεμπτικά χωρίς κωδικό",
        value: kpis.missingCodeParapemtika,
      },
      {
        key: "execution",
        title: "Παραπεμπτικά προς εκτέλεση",
        value: parapemtikaCount,
      },
    ];
  }, [expiring30Count, kpis.missingCodeParapemtika, parapemtikaCount]);

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
      return (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setShowTodayModal(true)}
          onKeyDown={(e) => e.key === "Enter" && setShowTodayModal(true)}
          className="rounded-2xl border border-border bg-panel px-4 py-3 cursor-pointer hover:border-primary/40 transition-colors"
        >
          <div className="text-xs text-muted">Συνεδρίες Σήμερα</div>
          <div className="mt-1 text-xl font-semibold">{loading ? "…" : kpis.todaySessions}</div>
          <div className="mt-0.5 text-xs text-muted">πάτα για πρόγραμμα & παρουσίες</div>
        </div>
      );
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

    if (widgetId === "kpi_no_code") {
      return (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setShowNoCodeModal(true)}
          onKeyDown={(e) => e.key === "Enter" && setShowNoCodeModal(true)}
          className="rounded-2xl border border-border bg-panel px-4 py-3 cursor-pointer hover:border-primary/40 transition-colors"
        >
          <div className="text-xs text-muted">Παραπεμπτικό χωρίς κωδικό γονέα</div>
          <div className="mt-1 text-xl font-semibold">{loading ? "…" : noCodeCount}</div>
          <div className="mt-0.5 text-xs text-muted">χωρίς κωδικό γονέα</div>
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
              function handleClick() {
                if (it.key === "expiring30") setShowExpiringModal(true)
                else if (it.key === "missingCode") setShowNoCodeModal(true)
                else if (it.key === "execution") setShowExecutionModal(true)
              }
              return (
                <div
                  key={it.key}
                  onClick={handleClick}
                  className="flex items-center justify-between rounded-xl border border-border bg-bg px-3 py-2 cursor-pointer hover:bg-bg/60 transition"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && handleClick()}
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

      {/* Modal: Execution parapemtika */}
      {tenantId && (
        <ParapemtikaExecutionModal
          open={showExecutionModal}
          tenantId={tenantId}
          onClose={() => setShowExecutionModal(false)}
          onCountChange={setParapemtikaCount}
        />
      )}

      {/* Modal: No-code parapemtika */}
      {tenantId && (
        <ParapemtikaNoCodeModal
          open={showNoCodeModal}
          tenantId={tenantId}
          onClose={() => setShowNoCodeModal(false)}
          onCountChange={setNoCodeCount}
        />
      )}

      {/* Modal: Today sessions */}
      {tenantId && (
        <TodaySessionsModal
          open={showTodayModal}
          tenantId={tenantId}
          onClose={() => setShowTodayModal(false)}
        />
      )}

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

      {/* Modal: Expiring 30-day parapemtika */}
      {tenantId && (
        <ParapemtikaExpiring30Modal
          open={showExpiringModal}
          tenantId={tenantId}
          onClose={() => setShowExpiringModal(false)}
          onCountChange={setExpiring30Count}
        />
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
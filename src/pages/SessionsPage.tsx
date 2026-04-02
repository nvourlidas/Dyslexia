// src/pages/SessionsPage.tsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/auth/AuthProvider";
import { callFunction } from "@/lib/api";
import ToastHost from "@/components/ui/ToastHost";
import SessionDayModal from "@/components/session/SessionDayModal";
import ClassesModal, { type ClassRow } from "@/components/session/ClassesModal";
import { useToast } from "@/hooks/useToast";
import { PALETTE, toDateKey, toISO, groupByTeacher } from "@/lib/session.utils";
import type {
  ClassSession, TeacherOption, StudentOption, TeacherDayGroup, AttendanceStatus,
} from "@/types/session";

const MONTHS = [
  "Ιανουάριος","Φεβρουάριος","Μάρτιος","Απρίλιος","Μάιος","Ιούνιος",
  "Ιούλιος","Αύγουστος","Σεπτέμβριος","Οκτώβριος","Νοέμβριος","Δεκέμβριος",
];
const DAYS = ["Δευ","Τρί","Τετ","Πέμ","Παρ","Σάβ","Κυρ"];

const SESSION_SELECT = `
  id, tenant_id, class_id, teacher_id, starts_at, ends_at, status, notes, created_at, updated_at,
  teacher:teacher(name, last_name),
  class_session_students(session_id, student_id, status, marked_at,
    student:students(name, lastname)
  )
`.trim();

const COLOR_MAP_KEY = "sessions_color_map_v1";

function loadColorMap(tenantId: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(`${COLOR_MAP_KEY}_${tenantId}`);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveColorMap(tenantId: string, map: Record<string, number>) {
  try { localStorage.setItem(`${COLOR_MAP_KEY}_${tenantId}`, JSON.stringify(map)); }
  catch {}
}

export default function SessionsPage() {
  const { profile, profileLoading } = useAuth();
  const tenantId = profile?.tenant_id ?? null;
  const { toasts, pushToast, dismissToast } = useToast();

  const today = new Date();
  const [curMonth, setCurMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [colorMap, setColorMap] = useState<Record<string, number>>({});

  const [modalDate, setModalDate] = useState<string | null>(null);
  const [classesOpen, setClassesOpen] = useState(false);

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (profileLoading || !tenantId) return;
    setColorMap(loadColorMap(tenantId));
    loadTeachers();
    loadStudents();
    loadClasses();
  }, [profileLoading, tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    loadSessions();
  }, [tenantId, curMonth]);

  async function loadTeachers() {
    const { data } = await supabase
      .from("teacher")
      .select("id, name, last_name")
      .eq("tenant_id", tenantId!)
      .eq("active", true)
      .order("last_name");
    setTeachers((data ?? []) as TeacherOption[]);
  }

  async function loadStudents() {
    const { data } = await supabase
      .from("students")
      .select("user_id, name, lastname")
      .eq("tenant_id", tenantId!)
      .eq("active", true)
      .order("lastname");
    setStudents((data ?? []) as StudentOption[]);
  }

  async function loadClasses() {
    const { data } = await supabase
      .from("classes")
      .select("id, title, description, active")
      .eq("tenant_id", tenantId!)
      .order("created_at", { ascending: true });
    setClasses((data ?? []) as ClassRow[]);
  }

  async function loadSessions() {
    if (!tenantId) return;
    setLoading(true);
    const monthStart = new Date(curMonth.getFullYear(), curMonth.getMonth(), 1).toISOString();
    const monthEnd = new Date(curMonth.getFullYear(), curMonth.getMonth() + 1, 0, 23, 59, 59).toISOString();

    const { data, error } = await supabase
      .from("class_sessions")
      .select(SESSION_SELECT)
      .eq("tenant_id", tenantId)
      .gte("starts_at", monthStart)
      .lte("starts_at", monthEnd)
      .order("starts_at");

    if (error) {
      pushToast({ variant: "error", title: "Σφάλμα φόρτωσης", message: error.message });
      setLoading(false);
      return;
    }

    const normalized = (data ?? []).map((s: any) => ({
      ...s,
      teacher: Array.isArray(s.teacher) ? s.teacher[0] ?? null : s.teacher ?? null,
      class_session_students: (s.class_session_students ?? []).map((css: any) => ({
        ...css,
        student: Array.isArray(css.student) ? css.student[0] ?? null : css.student ?? null,
      })),
    })) as ClassSession[];

    setSessions(normalized);
    setLoading(false);
  }

  // ── Calendar ───────────────────────────────────────────────────────────────
  const sessionsByDate = useMemo(() => {
    const map: Record<string, ClassSession[]> = {};
    sessions.forEach((s) => {
      const key = toDateKey(s.starts_at);
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [sessions]);

  const calCells = useMemo(() => {
    const first = new Date(curMonth.getFullYear(), curMonth.getMonth(), 1);
    let dow = first.getDay();
    if (dow === 0) dow = 7;
    const prevDays = new Date(curMonth.getFullYear(), curMonth.getMonth(), 0).getDate();
    const daysInMonth = new Date(curMonth.getFullYear(), curMonth.getMonth() + 1, 0).getDate();
    const cells: { d: number; cur: boolean; dateKey: string | null }[] = [];
    for (let i = dow - 1; i > 0; i--)
      cells.push({ d: prevDays - i + 1, cur: false, dateKey: null });
    for (let i = 1; i <= daysInMonth; i++) {
      const dk = `${curMonth.getFullYear()}-${String(curMonth.getMonth() + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      cells.push({ d: i, cur: true, dateKey: dk });
    }
    while (cells.length % 7 !== 0) cells.push({ d: 0, cur: false, dateKey: null });
    return cells;
  }, [curMonth]);

  function getDayTeachers(dateKey: string) {
    const ss = sessionsByDate[dateKey] ?? [];
    const seen = new Set<string>();
    return ss.filter((s) => { if (seen.has(s.teacher_id)) return false; seen.add(s.teacher_id); return true; });
  }

  function isToday(dateKey: string) {
    return dateKey === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  }

  const modalGroups: TeacherDayGroup[] = useMemo(() => {
    if (!modalDate) return [];
    return groupByTeacher(sessionsByDate[modalDate] ?? [], colorMap);
  }, [modalDate, sessionsByDate, colorMap]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleAddSlot = useCallback(
    async (teacherId: string, startTime: string, endTime: string, studentId: string, colorIdx: number) => {
      if (!tenantId || !modalDate) return;

      // Persist color
      const newMap = { ...colorMap, [teacherId]: colorIdx };
      setColorMap(newMap);
      saveColorMap(tenantId, newMap);

      // Use the first active class found — optional, null if none exist yet
      const firstClass = classes.find((c) => c.active) ?? classes[0] ?? null;

      try {
        await callFunction("session-create", {
          teacher_id: teacherId,
          starts_at: toISO(modalDate, startTime),
          ends_at: toISO(modalDate, endTime),
          student_id: studentId || null,
          class_id: firstClass?.id ?? null,
        });
        await loadSessions();
        pushToast({ variant: "success", title: "Slot προστέθηκε" });
      } catch (e: any) {
        pushToast({ variant: "error", title: "Σφάλμα", message: e?.message });
      }
    },
    [tenantId, modalDate, colorMap, classes]
  );

  const handleRemoveTeacher = useCallback(
    async (teacherId: string) => {
      if (!tenantId || !modalDate) return;
      const toDelete = (sessionsByDate[modalDate] ?? []).filter((s) => s.teacher_id === teacherId);
      try {
        await Promise.all(toDelete.map((s) => callFunction("session-delete", { id: s.id })));
        await loadSessions();
        pushToast({ variant: "success", title: "Καθηγητής αφαιρέθηκε" });
      } catch (e: any) {
        pushToast({ variant: "error", title: "Σφάλμα", message: e?.message });
      }
    },
    [tenantId, modalDate, sessionsByDate]
  );

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    try {
      await callFunction("session-delete", { id: sessionId });
      await loadSessions();
      pushToast({ variant: "success", title: "Slot διαγράφηκε" });
    } catch (e: any) {
      pushToast({ variant: "error", title: "Σφάλμα", message: e?.message });
    }
  }, []);

  const handleAttendance = useCallback(async (sessionId: string, status: AttendanceStatus) => {
    try {
      await callFunction("session-attendance", { session_id: sessionId, status });
      await loadSessions();
    } catch (e: any) {
      pushToast({ variant: "error", title: "Σφάλμα παρουσίας", message: e?.message });
    }
  }, []);

  const handleEditStudent = useCallback(async (session: ClassSession, studentId: string) => {
    try {
      await callFunction("session-update", { id: session.id, student_id: studentId || null });
      await loadSessions();
      pushToast({ variant: "success", title: "Μαθητής ενημερώθηκε" });
    } catch (e: any) {
      pushToast({ variant: "error", title: "Σφάλμα", message: e?.message });
    }
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-full w-full p-6">
      <ToastHost toasts={toasts} dismiss={dismissToast} />

      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h1 className="text-lg font-semibold">
          {MONTHS[curMonth.getMonth()]} {curMonth.getFullYear()}
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Classes management button */}
          <button
            className="h-9 px-3 rounded-md text-sm border border-border/15 hover:bg-panel2 cursor-pointer"
            onClick={() => setClassesOpen(true)}
          >
            Τάξεις {classes.length > 0 && <span className="ml-1 text-xs text-muted">({classes.length})</span>}
          </button>

          <div className="w-px h-5 bg-border/20" />

          <button
            className="h-9 px-3 rounded-md text-sm border border-border/15 hover:bg-panel2 cursor-pointer"
            onClick={() => setCurMonth(new Date(curMonth.getFullYear(), curMonth.getMonth() - 1, 1))}
          >← Προηγ.</button>
          <button
            className="h-9 px-3 rounded-md text-sm border border-border/15 hover:bg-panel2 cursor-pointer"
            onClick={() => setCurMonth(new Date(today.getFullYear(), today.getMonth(), 1))}
          >Σήμερα</button>
          <button
            className="h-9 px-3 rounded-md text-sm border border-border/15 hover:bg-panel2 cursor-pointer"
            onClick={() => setCurMonth(new Date(curMonth.getFullYear(), curMonth.getMonth() + 1, 1))}
          >Επόμ. →</button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="rounded-lg border border-border/15 overflow-hidden">
        <div className="grid grid-cols-7 bg-panel2/60">
          {DAYS.map((d) => (
            <div key={d} className="px-2 py-2 text-center text-xs font-medium text-muted">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 divide-x divide-y divide-border/10">
          {calCells.map((cell, idx) => {
            const dayTeachers = cell.dateKey ? getDayTeachers(cell.dateKey) : [];
            const tod = cell.dateKey ? isToday(cell.dateKey) : false;
            return (
              <div
                key={idx}
                className={`min-h-[100px] p-1.5 transition-colors ${
                  cell.cur ? "bg-panel cursor-pointer hover:bg-panel2/50" : "bg-panel/30 opacity-40"
                }`}
                onClick={() => cell.dateKey && setModalDate(cell.dateKey)}
              >
                <div className="flex items-center justify-start mb-1">
                  <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                    tod ? "bg-primary text-white" : cell.cur ? "text-text" : "text-muted"
                  }`}>
                    {cell.d || ""}
                  </span>
                </div>
                {dayTeachers.slice(0, 3).map((s) => {
                  const col = PALETTE[colorMap[s.teacher_id] ?? 0];
                  return (
                    <div
                      key={s.teacher_id}
                      className="text-[10px] px-1.5 py-0.5 rounded mb-0.5 truncate"
                      style={{ background: col.bg, color: col.text }}
                    >
                      {s.teacher?.last_name ?? "—"}
                    </div>
                  );
                })}
                {dayTeachers.length > 3 && (
                  <div className="text-[10px] text-muted px-1">+{dayTeachers.length - 3} ακόμα</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {loading && <div className="text-center text-sm text-muted mt-4">Φόρτωση sessions…</div>}

      {/* Day Modal */}
      {modalDate && (
        <SessionDayModal
          open={!!modalDate}
          dateKey={modalDate}
          groups={modalGroups}
          teachers={teachers}
          students={students}
          onClose={() => setModalDate(null)}
          onAddSlot={handleAddSlot}
          onRemoveTeacher={handleRemoveTeacher}
          onAttendance={handleAttendance}
          onEditStudent={handleEditStudent}
          onDeleteSession={handleDeleteSession}
        />
      )}

      {/* Classes Modal */}
      <ClassesModal
        open={classesOpen}
        classes={classes}
        onClose={() => setClassesOpen(false)}
        onRefresh={loadClasses}
      />
    </div>
  );
}

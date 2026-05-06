// src/pages/AttendancePage.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/auth/AuthProvider";
import { useToast } from "@/hooks/useToast";
import ToastHost from "@/components/ui/ToastHost";
import { Loader2, ArrowUpDown } from "lucide-react";
import type { AttendanceStatus } from "@/types/session";

const MONTHS = [
  "Ιανουάριος", "Φεβρουάριος", "Μάρτιος", "Απρίλιος", "Μάιος", "Ιούνιος",
  "Ιούλιος", "Αύγουστος", "Σεπτέμβριος", "Οκτώβριος", "Νοέμβριος", "Δεκέμβριος",
];

const SESSION_SELECT = `
  id, teacher_id, starts_at, ends_at, status, notes,
  teacher:teacher(name, last_name),
  class_session_students(session_id, student_id, status, marked_at, notes,
    student:students(name, lastname)
  )
`.trim();

type AttendanceRow = {
  session_id: string;
  student_id: string;
  student_name: string;
  student_lastname: string;
  teacher_name: string;
  starts_at: string;
  ends_at: string;
  status: AttendanceStatus;
  marked_at?: string;
  session_notes?: string | null;
  attendance_notes?: string | null;
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("el-GR");
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 font-semibold text-left text-xs uppercase tracking-wide text-muted">
      {children}
    </th>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}

export default function AttendancePage() {
  const { profile, profileLoading } = useAuth();
  const tenantId = profile?.tenant_id ?? null;
  const { toasts, pushToast, dismissToast } = useToast();

  const today = new Date();
  const [filterYear, setFilterYear] = useState(today.getFullYear());
  const [filterMonth, setFilterMonth] = useState(today.getMonth() + 1); // 1-indexed
  const [filterDay, setFilterDay] = useState<string>(""); // "" = all days
  const [sortAsc, setSortAsc] = useState(true);
  const [q, setQ] = useState("");

  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    if (profileLoading || !tenantId) return;
    load();
  }, [profileLoading, tenantId, filterYear, filterMonth]);

  useEffect(() => {
    setPage(1);
  }, [filterYear, filterMonth, filterDay, q, pageSize, sortAsc]);

  async function load() {
    if (!tenantId) return;
    setLoading(true);

    // filterMonth is 1-indexed; new Date(year, month-1, 1) = first day of month
    const monthStart = new Date(filterYear, filterMonth - 1, 1).toISOString();
    // new Date(year, month, 0) = last day of the month (day 0 of next month = last day of current)
    const monthEnd = new Date(filterYear, filterMonth, 0, 23, 59, 59).toISOString();

    const { data, error } = await supabase
      .from("class_sessions")
      .select(SESSION_SELECT)
      .eq("tenant_id", tenantId)
      .gte("starts_at", monthStart)
      .lte("starts_at", monthEnd)
      .order("starts_at");

    if (error) {
      pushToast({ variant: "error", title: "Σφάλμα φόρτωσης παρουσιών", message: error.message });
      setLoading(false);
      return;
    }

    const sessions = (data ?? []).map((s: any) => ({
      ...s,
      teacher: Array.isArray(s.teacher) ? s.teacher[0] ?? null : s.teacher ?? null,
      class_session_students: (s.class_session_students ?? []).map((css: any) => ({
        ...css,
        student: Array.isArray(css.student) ? css.student[0] ?? null : css.student ?? null,
      })),
    }));

    const flat: AttendanceRow[] = sessions.flatMap((session: any) =>
      (session.class_session_students ?? []).map((ss: any) => ({
        session_id: session.id,
        student_id: ss.student_id,
        student_name: ss.student?.name ?? "",
        student_lastname: ss.student?.lastname ?? "",
        teacher_name: session.teacher
          ? `${session.teacher.name} ${session.teacher.last_name}`
          : "—",
        starts_at: session.starts_at,
        ends_at: session.ends_at,
        status: ss.status as AttendanceStatus,
        marked_at: ss.marked_at,
        session_notes: session.notes,
        attendance_notes: ss.notes,
      }))
    );

    setRows(flat);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    let result = rows;

    if (filterDay) {
      const day = parseInt(filterDay, 10);
      result = result.filter((r) => new Date(r.starts_at).getDate() === day);
    }

    if (q) {
      const needle = q.toLowerCase();
      result = result.filter(
        (r) =>
          `${r.student_lastname} ${r.student_name}`.toLowerCase().includes(needle) ||
          r.teacher_name.toLowerCase().includes(needle)
      );
    }

    return [...result].sort((a, b) => {
      const diff = new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
      return sortAsc ? diff : -diff;
    });
  }, [rows, filterDay, q, sortAsc]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const startIdx = filtered.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIdx = Math.min(filtered.length, page * pageSize);

  const yearOptions = useMemo(() => {
    const cur = today.getFullYear();
    return [cur - 2, cur - 1, cur, cur + 1];
  }, []);

  const daysInMonth = new Date(filterYear, filterMonth, 0).getDate();

  const presentCount = filtered.filter((r) => r.status === "present").length;
  const absentCount = filtered.filter((r) => r.status === "absent").length;

  return (
    <div className="min-h-full w-full p-3 sm:p-4 md:p-6">
      <ToastHost toasts={toasts} dismiss={dismissToast} />

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          className="h-9 w-full rounded-md border border-border/10 bg-panel2 px-3 text-sm placeholder:text-muted sm:w-64"
          placeholder="Αναζήτηση μαθητή / καθηγητή…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <select
          className="h-9 rounded-md border border-border/10 bg-panel2 px-2 text-sm"
          value={filterYear}
          onChange={(e) => { setFilterYear(Number(e.target.value)); setFilterDay(""); }}
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        <select
          className="h-9 rounded-md border border-border/10 bg-panel2 px-2 text-sm"
          value={filterMonth}
          onChange={(e) => { setFilterMonth(Number(e.target.value)); setFilterDay(""); }}
        >
          {MONTHS.map((m, i) => (
            <option key={i + 1} value={i + 1}>{m}</option>
          ))}
        </select>

        <select
          className="h-9 rounded-md border border-border/10 bg-panel2 px-2 text-sm"
          value={filterDay}
          onChange={(e) => setFilterDay(e.target.value)}
        >
          <option value="">Όλες οι μέρες</option>
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        <button
          className="h-9 inline-flex items-center gap-2 rounded-md border border-border/10 bg-panel2 px-3 text-sm hover:bg-secondary/20 cursor-pointer"
          onClick={() => setSortAsc((v) => !v)}
          title={sortAsc ? "Εναλλαγή σε φθίνουσα" : "Εναλλαγή σε αύξουσα"}
        >
          <ArrowUpDown className="h-4 w-4" />
          {sortAsc ? "Παλαιότερο πρώτα" : "Νεότερο πρώτα"}
        </button>
      </div>

      {/* Summary badges */}
      {!loading && filtered.length > 0 && (
        <div className="mb-3 flex gap-3 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-3 py-1 text-green-400 font-medium">
            <span className="h-2 w-2 rounded-full bg-green-400" />
            Παρόντες: {presentCount}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 text-red-400 font-medium">
            <span className="h-2 w-2 rounded-full bg-red-400" />
            Απόντες: {absentCount}
          </span>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border/10 bg-panel">
        <table className="w-full text-sm">
          <thead className="border-b border-border/10">
            <tr>
              <Th>Ημερομηνία</Th>
              <Th>Ώρα</Th>
              <Th>Μαθητής</Th>
              <Th>Καθηγητής</Th>
              <Th>Παρουσία</Th>
              <Th>Σημειώσεις</Th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="py-12 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted" />
                </td>
              </tr>
            )}

            {!loading && paginated.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-muted">
                  Δεν βρέθηκαν παρουσίες για τα επιλεγμένα φίλτρα.
                </td>
              </tr>
            )}

            {!loading &&
              paginated.map((row, i) => (
                <tr
                  key={`${row.session_id}_${row.student_id}`}
                  className={`border-b border-border/5 transition-colors ${
                    i % 2 !== 0 ? "bg-secondary/5" : ""
                  }`}
                >
                  <Td>{formatDate(row.starts_at)}</Td>
                  <Td className="text-muted">
                    {formatTime(row.starts_at)} – {formatTime(row.ends_at)}
                  </Td>
                  <Td className="font-medium">
                    {row.student_lastname} {row.student_name}
                  </Td>
                  <Td className="text-muted">{row.teacher_name}</Td>
                  <Td>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        row.status === "present"
                          ? "bg-green-500/15 text-green-400"
                          : "bg-red-500/15 text-red-400"
                      }`}
                    >
                      {row.status === "present" ? "Παρών" : "Απών"}
                    </span>
                  </Td>
                  <Td className="text-muted text-xs max-w-[200px] truncate">
                    {row.attendance_notes ?? row.session_notes ?? "—"}
                  </Td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && filtered.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
          <div>
            {startIdx}–{endIdx} από {filtered.length} εγγραφές
          </div>
          <div className="flex items-center gap-2">
            <select
              className="h-8 rounded border border-border/10 bg-panel2 px-2 text-sm"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>{n} / σελίδα</option>
              ))}
            </select>
            <button
              className="h-8 rounded border border-border/10 bg-panel2 px-3 disabled:opacity-40 hover:bg-secondary/20 cursor-pointer"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              ‹
            </button>
            <span>{page} / {pageCount}</span>
            <button
              className="h-8 rounded border border-border/10 bg-panel2 px-3 disabled:opacity-40 hover:bg-secondary/20 cursor-pointer"
              disabled={page === pageCount}
              onClick={() => setPage((p) => p + 1)}
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

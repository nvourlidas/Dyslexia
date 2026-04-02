// src/lib/session.utils.ts
import type { ClassSession, TeacherDayGroup } from "@/types/session";

export const PALETTE = [
  { name: "Γαλάζιο",   bg: "#E6F1FB", text: "#0C447C", dot: "#378ADD" },
  { name: "Πράσινο",   bg: "#E1F5EE", text: "#085041", dot: "#1D9E75" },
  { name: "Πορτοκαλί", bg: "#FAEEDA", text: "#633806", dot: "#EF9F27" },
  { name: "Ροζ",       bg: "#FBEAF0", text: "#4B1528", dot: "#D4537E" },
  { name: "Μωβ",       bg: "#EEEDFE", text: "#3C3489", dot: "#7F77DD" },
  { name: "Κοραλί",    bg: "#FAECE7", text: "#712B13", dot: "#D85A30" },
];

// Format ISO date to YYYY-MM-DD key
export function toDateKey(iso: string): string {
  return iso.slice(0, 10);
}

// Format time from ISO: "13:30"
export function toTimeStr(iso: string): string {
  const d = new Date(iso);
  return d.toTimeString().slice(0, 5);
}

// "13:30" + YYYY-MM-DD → ISO string
export function toISO(dateKey: string, timeStr: string): string {
  return `${dateKey}T${timeStr}:00`;
}

export function formatDayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const months = [
    "Ιανουάριος","Φεβρουάριος","Μάρτιος","Απρίλιος","Μάιος","Ιούνιος",
    "Ιούλιος","Αύγουστος","Σεπτέμβριος","Οκτώβριος","Νοέμβριος","Δεκέμβριος",
  ];
  return `${d} ${months[m - 1]} ${y}`;
}

// Group flat sessions by teacher for the day modal
export function groupByTeacher(
  sessions: ClassSession[],
  colorMap: Record<string, number>
): TeacherDayGroup[] {
  const map = new Map<string, TeacherDayGroup>();
  sessions.forEach((s) => {
    const tid = s.teacher_id;
    if (!map.has(tid)) {
      const tName = s.teacher
        ? `${s.teacher.last_name} ${s.teacher.name}`
        : tid;
      map.set(tid, {
        teacher_id: tid,
        teacher_name: tName,
        colorIdx: colorMap[tid] ?? 0,
        slots: [],
      });
    }
    map.get(tid)!.slots.push(s);
  });
  // sort slots by starts_at within each group
  map.forEach((g) => g.slots.sort((a, b) => a.starts_at.localeCompare(b.starts_at)));
  return Array.from(map.values());
}

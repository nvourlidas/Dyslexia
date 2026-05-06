// src/components/sessions/SessionDayModal.tsx
import React, { useState } from "react";
import { Loader2, Trash2, Check, X, Pencil, Printer } from "lucide-react";
import { PALETTE, toTimeStr } from "@/lib/session.utils";
import SessionPdfPreviewModal from "@/components/session/SessionPdfPreviewModal";
import type {
  ClassSession, TeacherDayGroup, TeacherOption, StudentOption, AttendanceStatus,
} from "@/types/session";

function ColorPicker({ selected, onChange }: { selected: number; onChange: (i: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      {PALETTE.map((p, i) => (
        <button key={i} type="button" onClick={() => onChange(i)}
          className="w-5 h-5 rounded-full transition-transform hover:scale-110"
          style={{ background: p.dot, border: i === selected ? "2px solid var(--color-text-primary)" : "2px solid transparent" }}
          title={p.name} />
      ))}
    </div>
  );
}

function SlotRow({ session, students, onAttendance, onEditStudent, onDelete }: {
  session: ClassSession;
  students: StudentOption[];
  onAttendance: (sessionId: string, status: AttendanceStatus) => Promise<void>;
  onEditStudent: (session: ClassSession, studentId: string) => Promise<void>;
  onDelete: (sessionId: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [editStudentId, setEditStudentId] = useState("");
  const [busy, setBusy] = useState(false);
  const ss = session.class_session_students?.[0];
  const studentName = ss?.student ? `${ss.student.lastname} ${ss.student.name}` : "";
  const currentStatus = (ss?.status ?? "") as AttendanceStatus | "";
  const startTime = toTimeStr(session.starts_at);
  const endTime = toTimeStr(session.ends_at);

  return (
    <div className="flex items-center gap-3 px-3 py-2 border-t border-border/10 text-sm">
      <span className="w-28 text-xs text-muted font-mono shrink-0">{startTime} – {endTime}</span>
      {editing ? (
        <div className="flex items-center gap-2 flex-1">
          <select className="input text-sm py-1 flex-1" value={editStudentId} onChange={(e) => setEditStudentId(e.target.value)}>
            <option value="">— χωρίς μαθητή —</option>
            {students.map((s) => <option key={s.user_id} value={s.user_id}>{s.lastname} {s.name}</option>)}
          </select>
          <button className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white disabled:opacity-50"
            onClick={async () => { setBusy(true); await onEditStudent(session, editStudentId); setEditing(false); setBusy(false); }} disabled={busy}>
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          </button>
          <button className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/15" onClick={() => setEditing(false)}>
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <>
          <span className={`flex-1 ${studentName ? "" : "text-muted italic"}`}>{studentName || "χωρίς μαθητή"}</span>
          <div className="flex items-center gap-1.5">
            {ss && (<>
              <button className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${currentStatus === "present" ? "bg-green-500/15 text-green-700 border-green-300" : "border-border/15 text-muted hover:bg-green-500/10"}`}
                onClick={async () => { setBusy(true); await onAttendance(session.id, "present"); setBusy(false); }} disabled={busy}>Παρών</button>
              <button className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${currentStatus === "absent" ? "bg-red-500/15 text-red-700 border-red-300" : "border-border/15 text-muted hover:bg-red-500/10"}`}
                onClick={async () => { setBusy(true); await onAttendance(session.id, "absent"); setBusy(false); }} disabled={busy}>Απών</button>
            </>)}
            <button className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/10 hover:bg-panel2"
              onClick={() => { setEditStudentId(ss?.student_id ?? ""); setEditing(true); }} title="Επεξεργασία μαθητή">
              <Pencil className="h-3 w-3" />
            </button>
            <button className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-red-400/50 text-red-400 hover:bg-red-500/10 disabled:opacity-40"
              onClick={async () => { if (!confirm("Διαγραφή αυτού του slot;")) return; setBusy(true); await onDelete(session.id); setBusy(false); }} disabled={busy}>
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function TeacherBlock({ group, students, onAttendance, onEditStudent, onDeleteSession, onAddSlot, onRemoveTeacher, onLastSlotDeleted }: {
  group: TeacherDayGroup;
  students: StudentOption[];
  onAttendance: (sessionId: string, status: AttendanceStatus) => Promise<void>;
  onEditStudent: (session: ClassSession, studentId: string) => Promise<void>;
  onDeleteSession: (sessionId: string) => Promise<void>;
  onAddSlot: (teacherId: string, startTime: string, endTime: string, studentId: string) => Promise<void>;
  onRemoveTeacher: (teacherId: string) => void;
  onLastSlotDeleted: () => void;
}) {
  const col = PALETTE[group.colorIdx];
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [newStudent, setNewStudent] = useState("");
  const [addBusy, setAddBusy] = useState(false);

  const handleSlotDelete = async (sessionId: string) => {
    const wasLast = group.slots.length === 1;
    await onDeleteSession(sessionId);
    if (wasLast) onLastSlotDeleted();
  };

  return (
    <div className="rounded-lg border border-border/15 overflow-hidden mb-3">
      <div className="flex items-center justify-between px-3 py-2" style={{ background: col.bg }}>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: col.dot }} />
          <span className="font-medium text-sm" style={{ color: col.text }}>{group.teacher_name}</span>
          {group.slots.length > 0 && (
            <span className="text-xs opacity-70" style={{ color: col.text }}>
              {toTimeStr(group.slots[0].starts_at)} – {toTimeStr(group.slots[group.slots.length - 1].ends_at)}
            </span>
          )}
        </div>
        <button className="text-xs px-2 py-0.5 rounded border"
          style={{ borderColor: col.dot, color: col.text, background: "transparent" }}
          onClick={() => { if (confirm(`Αφαίρεση ${group.teacher_name};`)) onRemoveTeacher(group.teacher_id); }}>
          Αφαίρεση
        </button>
      </div>

      {group.slots.length === 0 && (
        <div className="px-3 py-2 text-xs text-muted italic border-t border-border/10">
          Δεν υπάρχουν slots ακόμα — πρόσθεσε παρακάτω.
        </div>
      )}
      <div className="overflow-x-auto">
        <div className="min-w-[380px]">
          {group.slots.map((s) => (
            <SlotRow key={s.id} session={s} students={students}
              onAttendance={onAttendance} onEditStudent={onEditStudent} onDelete={handleSlotDelete} />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 py-2 border-t border-border/10 bg-panel/30 flex-wrap">
        <span className="text-xs text-muted shrink-0">Νέο slot:</span>
        <div className="flex items-center gap-1">
          <input
            type="time"
            className="input text-xs py-1 w-28"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            title="Ώρα έναρξης"
          />
          <span className="text-xs text-muted">—</span>
          <input
            type="time"
            className="input text-xs py-1 w-28"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            title="Ώρα λήξης"
          />
        </div>
        <select className="input text-xs py-1 flex-1 min-w-32" value={newStudent} onChange={(e) => setNewStudent(e.target.value)}>
          <option value="">— Μαθητής (προαιρετικό) —</option>
          {students.map((s) => <option key={s.user_id} value={s.user_id}>{s.lastname} {s.name}</option>)}
        </select>
        <button
          className="btn btn-primary text-xs py-1 px-3 shrink-0 disabled:opacity-50 inline-flex items-center gap-1"
          onClick={async () => {
            if (!startTime || !endTime) { alert("Συμπλήρωσε ώρα έναρξης και λήξης."); return; }
            if (startTime >= endTime) { alert("Η ώρα λήξης πρέπει να είναι μετά την έναρξη."); return; }
            setAddBusy(true);
            await onAddSlot(group.teacher_id, startTime, endTime, newStudent);
            setStartTime(""); setEndTime(""); setNewStudent(""); setAddBusy(false);
          }}
          disabled={addBusy}
        >
          {addBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : "+ Slot"}
        </button>
      </div>
    </div>
  );
}

type PendingTeacher = { teacher: TeacherOption; colorIdx: number };

export default function SessionDayModal({ open, dateKey, groups, teachers, students, onClose,
  onAddSlot, onRemoveTeacher, onAttendance, onEditStudent, onDeleteSession }: {
  open: boolean;
  dateKey: string;
  groups: TeacherDayGroup[];
  teachers: TeacherOption[];
  students: StudentOption[];
  onClose: () => void;
  onAddSlot: (teacherId: string, startTime: string, endTime: string, studentId: string, colorIdx: number) => Promise<void>;
  onRemoveTeacher: (teacherId: string) => Promise<void>;
  onAttendance: (sessionId: string, status: AttendanceStatus) => Promise<void>;
  onEditStudent: (session: ClassSession, studentId: string) => Promise<void>;
  onDeleteSession: (sessionId: string) => Promise<void>;
}) {
  const [pending, setPending] = useState<PendingTeacher[]>([]);
  const [lastDateKey, setLastDateKey] = useState<string | null>(null);
  if (dateKey !== lastDateKey) { setLastDateKey(dateKey); setPending([]); }
  const [addOpen, setAddOpen] = useState(false);
  const [newTeacherId, setNewTeacherId] = useState("");
  const [newColorIdx, setNewColorIdx] = useState(0);
  const [pdfOpen, setPdfOpen] = useState(false);

  if (!open) return null;

  const [y, m, d] = dateKey.split("-").map(Number);
  const months = ["Ιαν","Φεβ","Μαρ","Απρ","Μαϊ","Ιουν","Ιουλ","Αυγ","Σεπ","Οκτ","Νοε","Δεκ"];
  const dayLabel = `${d} ${months[m - 1]} ${y}`;
  const existingIds = [...groups.map((g) => g.teacher_id), ...pending.map((p) => p.teacher.id)];
  const available = teachers.filter((t) => !existingIds.includes(t.id));

  const handleAddSlot = async (teacherId: string, start: string, end: string, student: string, colorIdx: number) => {
    await onAddSlot(teacherId, start, end, student, colorIdx);
    setPending((prev) => prev.filter((p) => p.teacher.id !== teacherId));
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-auto p-4">
        <div className="w-full max-w-2xl rounded-xl border border-border/15 bg-panel text-text shadow-xl my-4">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border/10 flex items-center justify-between sticky top-0 bg-panel z-10 rounded-t-xl">
            <div className="font-semibold">{dayLabel}</div>
            <div className="flex items-center gap-2">
              <button
                className="h-8 px-3 rounded-md text-xs border border-border/15 hover:bg-panel2 inline-flex items-center gap-1.5 cursor-pointer"
                onClick={() => setPdfOpen(true)}
                title="Εκτύπωση προγράμματος"
              >
                <Printer className="h-3.5 w-3.5" />
                Εκτύπωση
              </button>
              <button className="rounded px-2 py-1 hover:bg-border/5 text-muted" onClick={onClose}>✕</button>
            </div>
          </div>

          <div className="p-4">
            {groups.length === 0 && pending.length === 0 && (
              <p className="text-sm text-muted text-center py-4">Δεν υπάρχουν sessions για αυτή την ημέρα.</p>
            )}
            {groups.map((g) => (
              <TeacherBlock key={g.teacher_id} group={g} students={students}
                onAttendance={onAttendance} onEditStudent={onEditStudent} onDeleteSession={onDeleteSession}
                onAddSlot={(tid, start, end, student) => handleAddSlot(tid, start, end, student, g.colorIdx)}
                onRemoveTeacher={onRemoveTeacher}
                onLastSlotDeleted={() => {
                  const teacher = teachers.find((t) => t.id === g.teacher_id);
                  if (teacher) setPending((prev) => [...prev, { teacher, colorIdx: g.colorIdx }]);
                }} />
            ))}
            {pending.map((p) => (
              <TeacherBlock key={p.teacher.id}
                group={{ teacher_id: p.teacher.id, teacher_name: `${p.teacher.last_name} ${p.teacher.name}`, colorIdx: p.colorIdx, slots: [] }}
                students={students} onAttendance={onAttendance} onEditStudent={onEditStudent} onDeleteSession={onDeleteSession}
                onAddSlot={(tid, start, end, student) => handleAddSlot(tid, start, end, student, p.colorIdx)}
                onRemoveTeacher={() => setPending((prev) => prev.filter((x) => x.teacher.id !== p.teacher.id))}
                onLastSlotDeleted={() => {}} />
            ))}
            {!addOpen ? (
              <button className="w-full py-2.5 border border-dashed border-border/30 rounded-lg text-sm text-muted hover:bg-panel2 transition-colors"
                onClick={() => setAddOpen(true)}>+ Προσθήκη καθηγητή</button>
            ) : (
              <div className="border border-border/15 rounded-lg p-3">
                <div className="flex flex-wrap gap-3 mb-3 items-end">
                  <div className="flex-1 min-w-40">
                    <div className="text-xs text-muted mb-1">Καθηγητής</div>
                    <select className="input text-sm" value={newTeacherId} onChange={(e) => setNewTeacherId(e.target.value)}>
                      <option value="">— Επιλογή —</option>
                      {available.map((t) => <option key={t.id} value={t.id}>{t.last_name} {t.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="text-xs text-muted mb-1">Χρώμα</div>
                    <ColorPicker selected={newColorIdx} onChange={setNewColorIdx} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button className="btn text-sm" onClick={() => setAddOpen(false)}>Ακύρωση</button>
                  <button className="btn btn-primary text-sm" onClick={() => {
                    if (!newTeacherId) { alert("Επίλεξε καθηγητή."); return; }
                    const teacher = teachers.find((t) => t.id === newTeacherId)!;
                    setPending((prev) => [...prev, { teacher, colorIdx: newColorIdx }]);
                    setNewTeacherId(""); setNewColorIdx(0); setAddOpen(false);
                  }}>Προσθήκη</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <SessionPdfPreviewModal
        open={pdfOpen}
        dateLabel={dayLabel}
        groups={groups}
        onClose={() => setPdfOpen(false)}
      />
    </>
  );
}

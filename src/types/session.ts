// src/types/session.ts

export type AttendanceStatus = "present" | "absent";
export type SessionStatus = "scheduled" | "completed" | "cancelled";

export type SessionStudent = {
  session_id: string;
  student_id: string;
  status: AttendanceStatus;
  marked_at?: string;
  marked_by?: string;
  notes?: string | null;
  // joined
  student?: { name: string; lastname: string } | null;
};

// One slot = one class_session
export type ClassSession = {
  id: string;
  tenant_id: string;
  class_id: string | null;
  teacher_id: string;
  starts_at: string; // ISO
  ends_at: string;   // ISO
  status: SessionStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // joined
  teacher?: { name: string; last_name: string } | null;
  class_session_students?: SessionStudent[];
};

// UI-level grouping: one teacher block in the day modal
export type TeacherDayGroup = {
  teacher_id: string;
  teacher_name: string;
  colorIdx: number;
  slots: ClassSession[];
};

export type TeacherOption = {
  id: string;
  name: string;
  last_name: string;
};

export type StudentOption = {
  user_id: string;
  name: string;
  lastname: string;
};

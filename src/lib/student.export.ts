// src/lib/student.export.ts
import type { ColumnKey, StudentRow } from "@/types/student";
import { fmtDate } from "@/lib/dateUtils";

export type StudentExportObject = ReturnType<typeof studentToExportObject>;
export type ExportColumn = { key: keyof StudentExportObject; label: string };

export function buildStudentExportColumns(visibleCols: ColumnKey[]): ExportColumn[] {
  const base: ExportColumn[] = [
    { key: "full_name", label: "Ονοματεπώνυμο" },
    { key: "phone", label: "Τηλέφωνο" },
  ];

  const map: Record<ColumnKey, ExportColumn> = {
    email: { key: "email", label: "Email" },
    birthdate: { key: "birthdate", label: "Ημ. Γέννησης" },
    address: { key: "address", label: "Διεύθυνση" },
    city: { key: "city", label: "Πόλη" },
    amka: { key: "amka", label: "ΑΜΚΑ" },
    gender: { key: "gender", label: "Φύλο" },
    parent_name: { key: "parent_name", label: "Γονέας" },
    parent_phone1: { key: "parent_phone1", label: "Τηλ. Γονέα 1" },
    parent_phone2: { key: "parent_phone2", label: "Τηλ. Γονέα 2" },
    doctor_visit: { key: "doctor_visit", label: "Επίσκεψη Γιατρού" },
    doctor_name: { key: "doctor_name", label: "Γιατρός" },
    created_at: { key: "created_at", label: "Ημ. Δημιουργίας" },
  };

  const dynamic = visibleCols.map((k) => map[k]).filter(Boolean);
  return [...base, ...dynamic];
}

export function studentToExportObject(s: StudentRow) {
  return {
    full_name: `${s.lastname ?? ""} ${s.name ?? ""}`.trim() || "—",
    phone: s.phone ?? "—",
    email: s.email ?? "—",
    birthdate: fmtDate(s.birthdate),
    address: s.address ?? "—",
    city: s.city ?? "—",
    amka: s.amka ?? "—",
    gender: s.gender ?? "—",
    parent_name: s.parent_name ?? "—",
    parent_phone1: s.parent_phone1 ?? "—",
    parent_phone2: s.parent_phone2 ?? "—",
    doctor_visit: s.doctor_visit ? "Ναι" : "Όχι",
    doctor_name: s.doctor_name ?? "—",
    created_at: fmtDate(s.created_at),
  };
}

// src/lib/student.utils.ts
import type { StudentForm, StudentRow } from "@/types/student";

export const EMPTY_FORM: StudentForm = {
  name: "",
  lastname: "",
  amka: "",
  gender: "unknown",
  birthdate: "",
  address: "",
  city: "",
  phone: "",
  email: "",
  parent_name: "",
  parent_phone1: "",
  parent_phone2: "",
  active: true,
  doctor_visit: false,
  doctor_name: "",
};

export function formatDateDMY(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function toForm(s?: StudentRow | null): StudentForm {
  if (!s) return { ...EMPTY_FORM };
  return {
    name: s.name ?? "",
    lastname: s.lastname ?? "",
    amka: s.amka ?? "",
    gender: (s.gender ?? "unknown") as StudentForm["gender"],
    birthdate: s.birthdate ?? "",

    address: s.address ?? "",
    city: s.city ?? "",
    phone: s.phone ?? "",
    email: s.email ?? "",

    parent_name: s.parent_name ?? "",
    parent_phone1: s.parent_phone1 ?? "",
    parent_phone2: s.parent_phone2 ?? "",

    active: !!s.active,
    doctor_visit: !!s.doctor_visit,
    doctor_name: s.doctor_name ?? "",
  };
}

export function formToDb(f: StudentForm) {
  return {
    name: f.name.trim(),
    lastname: f.lastname.trim(),
    amka: f.amka.trim() || null,
    gender: f.gender,
    birthdate: f.birthdate || null,

    address: f.address.trim() || null,
    city: f.city.trim() || null,
    phone: f.phone.trim() || null,
    email: f.email.trim() || null,

    parent_name: f.parent_name.trim() || null,
    parent_phone1: f.parent_phone1.trim() || null,
    parent_phone2: f.parent_phone2.trim() || null,

    active: f.active,
    doctor_visit: f.doctor_visit,
    doctor_name: f.doctor_name.trim() || null,

    updated_at: new Date().toISOString(),
  };
}
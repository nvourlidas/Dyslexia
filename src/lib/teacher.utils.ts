import type { TeacherRow, TeacherForm } from "@/types/teacher";

export function formatDateDMY(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString("el-GR");
}

export function toForm(r?: TeacherRow | null): TeacherForm {
  if (!r) {
    return {
      name: "",
      last_name: "",
      phone: "",
      email: "",
      idikotita: "",
      active: true,
    };
  }
  return {
    name: r.name ?? "",
    last_name: r.last_name ?? "",
    phone: r.phone ?? "",
    email: r.email ?? "",
    idikotita: r.idikotita ?? "",
    active: r.active ?? true,
  };
}

export function formToDb(f: TeacherForm) {
  return {
    name: f.name.trim(),
    last_name: f.last_name.trim(),
    phone: f.phone.trim() || null,
    email: f.email.trim() || null,
    idikotita: f.idikotita.trim() || null,
    active: f.active,
    updated_at: new Date().toISOString(),
  };
}

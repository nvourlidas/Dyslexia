export type TeacherRow = {
  id: string;
  tenant_id: string;
  name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  idikotita: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type TeacherForm = {
  name: string;
  last_name: string;
  phone: string;
  email: string;
  idikotita: string;
  active: boolean;
};

export type TeacherColumnKey =
  | "email"
  | "phone"
  | "idikotita"
  | "active"
  | "created_at";

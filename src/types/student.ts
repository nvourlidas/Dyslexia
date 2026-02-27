// src/types/student.ts

export type Gender = "male" | "female" | "other" | "unknown";

export type StudentRow = {
  user_id: string;
  tenant_id: string | null;

  name: string | null;
  lastname: string | null;
  amka: string | null;
  gender: Gender | null;
  birthdate: string | null;

  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;

  parent_name: string | null;
  parent_phone1: string | null;
  parent_phone2: string | null;

  active: boolean | null;
  doctor_visit: boolean | null;
  doctor_name: string | null;

  created_at: string;
  updated_at: string | null;
};

export type StudentForm = {
  name: string;
  lastname: string;
  amka: string;
  gender: Gender;
  birthdate: string;

  address: string;
  city: string;
  phone: string;
  email: string;

  parent_name: string;
  parent_phone1: string;
  parent_phone2: string;

  active: boolean;
  doctor_visit: boolean;
  doctor_name: string;
};

export type ColumnKey =
  | "email"
  | "birthdate"
  | "address"
  | "city"
  | "amka"
  | "gender"
  | "parent_name"
  | "parent_phone1"
  | "parent_phone2"
  | "doctor_visit"
  | "doctor_name"
  | "created_at";
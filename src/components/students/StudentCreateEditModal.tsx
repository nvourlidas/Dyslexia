import React, { useEffect, useState } from "react";
import type { StudentForm, Gender } from "@/types/student";

function Modal({
  title,
  children,
  onClose,
  disableClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  disableClose?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-md border border-border/10 bg-panel text-text shadow-xl">
        <div className="px-4 py-3 border-b border-border/10 flex items-center justify-between">
          <div className="font-semibold">{title}</div>
          <button
            onClick={onClose}
            disabled={disableClose}
            className="rounded px-2 py-1 hover:bg-border/5 disabled:opacity-50"
          >
            ✕
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function FormRow({ label, children }: any) {
  return (
    <label className="block mb-3">
      <div className="mb-1 text-sm opacity-80">{label}</div>
      {children}
    </label>
  );
}

export default function StudentCreateEditModal({
  open,
  busy,
  title,
  initialForm,
  onClose,
  onSave,
}: {
  open: boolean;
  busy: boolean;
  title: string;
  initialForm: StudentForm;
  onClose: () => void;
  onSave: (form: StudentForm) => Promise<void> | void;
}) {
  const [form, setForm] = useState<StudentForm>(initialForm);

  // keep modal in sync when opening / switching edit row
  useEffect(() => {
    if (!open) return;
    setForm(initialForm);
  }, [open, initialForm]);

  if (!open) return null;

  const set = <K extends keyof StudentForm>(key: K, value: StudentForm[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

  const submit = async () => {
    await onSave(form);
  };

  return (
    <Modal title={title} onClose={onClose} disableClose={busy}>
      <FormRow label="Όνομα *">
        <input
          className="input"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
        />
      </FormRow>

      <FormRow label="Επώνυμο *">
        <input
          className="input"
          value={form.lastname}
          onChange={(e) => set("lastname", e.target.value)}
        />
      </FormRow>

      <FormRow label="Τηλέφωνο">
        <input
          className="input"
          value={form.phone}
          onChange={(e) => set("phone", e.target.value)}
        />
      </FormRow>

      <FormRow label="Email">
        <input
          className="input"
          type="email"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
        />
      </FormRow>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FormRow label="Πόλη">
          <input
            className="input"
            value={form.city}
            onChange={(e) => set("city", e.target.value)}
          />
        </FormRow>

        <FormRow label="ΑΜΚΑ">
          <input
            className="input"
            value={form.amka}
            onChange={(e) => set("amka", e.target.value)}
          />
        </FormRow>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FormRow label="Ημ. Γέννησης">
          <input
            className="input"
            type="date"
            value={form.birthdate}
            onChange={(e) => set("birthdate", e.target.value)}
          />
        </FormRow>

        <FormRow label="Φύλο">
          <select
            className="input"
            value={form.gender}
            onChange={(e) => set("gender", e.target.value as Gender)}
          >
            <option value="unknown">Άγνωστο</option>
            <option value="male">Άνδρας</option>
            <option value="female">Γυναίκα</option>
            <option value="other">Άλλο</option>
          </select>
        </FormRow>
      </div>

      <FormRow label="Διεύθυνση">
        <input
          className="input"
          value={form.address}
          onChange={(e) => set("address", e.target.value)}
        />
      </FormRow>

      <FormRow label="Γονέας">
        <input
          className="input"
          value={form.parent_name}
          onChange={(e) => set("parent_name", e.target.value)}
        />
      </FormRow>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FormRow label="Τηλ. Γονέα 1">
          <input
            className="input"
            value={form.parent_phone1}
            onChange={(e) => set("parent_phone1", e.target.value)}
          />
        </FormRow>

        <FormRow label="Τηλ. Γονέα 2">
          <input
            className="input"
            value={form.parent_phone2}
            onChange={(e) => set("parent_phone2", e.target.value)}
          />
        </FormRow>
      </div>

      <div className="flex items-center gap-4 mt-2">
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => set("active", e.target.checked)}
          />
          Active
        </label>

        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.doctor_visit}
            onChange={(e) => set("doctor_visit", e.target.checked)}
          />
          Επίσκεψη σε γιατρό
        </label>
      </div>

      <FormRow label="Γιατρός">
        <input
          className="input"
          value={form.doctor_name}
          onChange={(e) => set("doctor_name", e.target.value)}
          disabled={!form.doctor_visit}
        />
      </FormRow>

      <div className="mt-4 flex justify-end gap-2">
        <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
          Ακύρωση
        </button>

        <button className="btn btn-primary" onClick={submit} disabled={busy}>
          {busy ? "Αποθήκευση..." : "Αποθήκευση"}
        </button>
      </div>
    </Modal>
  );
}
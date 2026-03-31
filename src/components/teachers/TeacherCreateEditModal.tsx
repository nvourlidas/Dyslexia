import React, { useEffect, useState } from "react";
import type { TeacherForm } from "@/types/teacher";

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

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-3">
      <div className="mb-1 text-sm opacity-80">{label}</div>
      {children}
    </label>
  );
}

export default function TeacherCreateEditModal({
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
  initialForm: TeacherForm;
  onClose: () => void;
  onSave: (form: TeacherForm) => Promise<void> | void;
}) {
  const [form, setForm] = useState<TeacherForm>(initialForm);

  useEffect(() => {
    if (!open) return;
    setForm(initialForm);
  }, [open, initialForm]);

  if (!open) return null;

  const set = <K extends keyof TeacherForm>(key: K, value: TeacherForm[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

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
          value={form.last_name}
          onChange={(e) => set("last_name", e.target.value)}
        />
      </FormRow>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
      </div>

      <FormRow label="Ιδικότητα">
        <input
          className="input"
          value={form.idikotita}
          onChange={(e) => set("idikotita", e.target.value)}
          placeholder="π.χ. Λογοθεραπευτής"
        />
      </FormRow>

      <div className="mt-2">
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => set("active", e.target.checked)}
          />
          Ενεργός
        </label>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
          Ακύρωση
        </button>
        <button className="btn btn-primary" onClick={() => onSave(form)} disabled={busy}>
          {busy ? "Αποθήκευση..." : "Αποθήκευση"}
        </button>
      </div>
    </Modal>
  );
}

// src/components/sessions/ClassesModal.tsx
import React, { useState } from "react";
import { Loader2, Trash2, Pencil, Check, X } from "lucide-react";
import { callFunction } from "@/lib/api";

export type ClassRow = {
  id: string;
  title: string;
  description: string | null;
  active: boolean;
};

type ClassForm = { title: string; description: string; active: boolean };
const EMPTY_FORM: ClassForm = { title: "", description: "", active: true };

// ─── Inline edit row ──────────────────────────────────────────────────────────

function EditRow({
  cls,
  onSave,
  onCancel,
}: {
  cls: ClassRow;
  onSave: (id: string, f: ClassForm) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<ClassForm>({
    title: cls.title,
    description: cls.description ?? "",
    active: cls.active,
  });
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof ClassForm>(k: K, v: ClassForm[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="border border-primary/30 rounded-lg p-3 mb-2">
      <div className="grid grid-cols-1 gap-2 mb-2">
        <div>
          <div className="text-xs text-muted mb-1">Τίτλος *</div>
          <input className="input text-sm" value={form.title} onChange={(e) => set("title", e.target.value)} />
        </div>
        <div>
          <div className="text-xs text-muted mb-1">Περιγραφή</div>
          <textarea className="input text-sm min-h-16 resize-none" value={form.description} onChange={(e) => set("description", e.target.value)} />
        </div>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} />
          Ενεργή
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <button className="btn text-sm" onClick={onCancel} disabled={busy}>Ακύρωση</button>
        <button
          className="btn btn-primary text-sm inline-flex items-center gap-1 disabled:opacity-50"
          onClick={async () => { setBusy(true); await onSave(cls.id, form); setBusy(false); }}
          disabled={busy}
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          Αποθήκευση
        </button>
      </div>
    </div>
  );
}

// ─── Class row ────────────────────────────────────────────────────────────────

function ClassItem({
  cls,
  onEdit,
  onDelete,
}: {
  cls: ClassRow;
  onEdit: () => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const [delBusy, setDelBusy] = useState(false);

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 border border-border/15 rounded-lg mb-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{cls.title}</span>
          {!cls.active && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-panel2 text-muted">Ανενεργή</span>
          )}
        </div>
        {cls.description && (
          <div className="text-xs text-muted mt-0.5 truncate">{cls.description}</div>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/10 hover:bg-panel2"
          onClick={onEdit}
          title="Επεξεργασία"
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-red-400/50 text-red-400 hover:bg-red-500/10 disabled:opacity-40"
          onClick={async () => {
            if (!confirm(`Διαγραφή τάξης "${cls.title}";`)) return;
            setDelBusy(true);
            await onDelete(cls.id);
            setDelBusy(false);
          }}
          disabled={delBusy}
          title="Διαγραφή"
        >
          {delBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
        </button>
      </div>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function ClassesModal({
  open,
  classes,
  onClose,
  onRefresh,
}: {
  open: boolean;
  classes: ClassRow[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<ClassForm>({ ...EMPTY_FORM });
  const [addBusy, setAddBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const setAdd = <K extends keyof ClassForm>(k: K, v: ClassForm[K]) =>
    setAddForm((p) => ({ ...p, [k]: v }));

  const handleAdd = async () => {
    if (!addForm.title.trim()) { setError("Ο τίτλος είναι υποχρεωτικός."); return; }
    setAddBusy(true);
    setError(null);
    try {
      await callFunction("class-create", {
        title: addForm.title,
        description: addForm.description || null,
        active: addForm.active,
      });
      await onRefresh();
      setAddForm({ ...EMPTY_FORM });
      setShowAdd(false);
    } catch (e: any) {
      setError(e?.message ?? "Σφάλμα αποθήκευσης.");
    } finally {
      setAddBusy(false);
    }
  };

  const handleUpdate = async (id: string, f: ClassForm) => {
    setError(null);
    try {
      await callFunction("class-update", {
        id,
        title: f.title,
        description: f.description || null,
        active: f.active,
      });
      await onRefresh();
      setEditingId(null);
    } catch (e: any) {
      setError(e?.message ?? "Σφάλμα ενημέρωσης.");
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      await callFunction("class-delete", { id });
      await onRefresh();
    } catch (e: any) {
      setError(e?.message ?? "Σφάλμα διαγραφής.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-auto p-4">
      <div className="w-full max-w-lg rounded-xl border border-border/15 bg-panel text-text shadow-xl my-4">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border/10 flex items-center justify-between sticky top-0 bg-panel z-10 rounded-t-xl">
          <div className="font-semibold">Διαχείριση Τάξεων</div>
          <button className="rounded px-2 py-1 hover:bg-border/5 text-muted" onClick={onClose}>✕</button>
        </div>

        <div className="p-4">
          {error && (
            <div className="mb-3 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Class list */}
          {classes.length === 0 && !showAdd && (
            <p className="text-sm text-muted text-center py-4">Δεν υπάρχουν τάξεις ακόμα.</p>
          )}

          {classes.map((cls) =>
            editingId === cls.id ? (
              <EditRow
                key={cls.id}
                cls={cls}
                onSave={handleUpdate}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <ClassItem
                key={cls.id}
                cls={cls}
                onEdit={() => { setEditingId(cls.id); setShowAdd(false); }}
                onDelete={handleDelete}
              />
            )
          )}

          {/* Add form */}
          {showAdd ? (
            <div className="border border-border/15 rounded-lg p-3 mt-1">
              <div className="text-xs font-medium text-muted mb-2">Νέα Τάξη</div>
              <div className="grid gap-2 mb-3">
                <div>
                  <div className="text-xs text-muted mb-1">Τίτλος *</div>
                  <input
                    className="input text-sm"
                    placeholder="π.χ. Τμήμα Α"
                    value={addForm.title}
                    onChange={(e) => setAdd("title", e.target.value)}
                  />
                </div>
                <div>
                  <div className="text-xs text-muted mb-1">Περιγραφή</div>
                  <textarea
                    className="input text-sm min-h-16 resize-none"
                    placeholder="Προαιρετική περιγραφή..."
                    value={addForm.description}
                    onChange={(e) => setAdd("description", e.target.value)}
                  />
                </div>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={addForm.active} onChange={(e) => setAdd("active", e.target.checked)} />
                  Ενεργή
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button className="btn text-sm" onClick={() => { setShowAdd(false); setError(null); }} disabled={addBusy}>
                  Ακύρωση
                </button>
                <button
                  className="btn btn-primary text-sm inline-flex items-center gap-1 disabled:opacity-50"
                  onClick={handleAdd}
                  disabled={addBusy}
                >
                  {addBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  Προσθήκη
                </button>
              </div>
            </div>
          ) : (
            <button
              className="w-full py-2.5 border border-dashed border-border/30 rounded-lg text-sm text-muted hover:bg-panel2 transition-colors mt-1"
              onClick={() => { setShowAdd(true); setEditingId(null); }}
            >
              + Νέα Τάξη
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Loader2, Plus, Trash2, StickyNote } from "lucide-react";
import NoteEditorModal from "./NoteEditorModal";

type Note = {
  id: string;
  content: string;
  completed: boolean;
  created_at: string;
};

function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default function NotepadSection({ tenantId }: { tenantId: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadNotes();
  }, [tenantId]);

  async function loadNotes() {
    setLoading(true);
    const todayStart = startOfTodayIso();

    // Delete notes from previous days (end-of-day cleanup)
    await supabase
      .from("dashboard_notes")
      .delete()
      .eq("tenant_id", tenantId)
      .lt("created_at", todayStart);

    const { data } = await supabase
      .from("dashboard_notes")
      .select("id, content, completed, created_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", todayStart)
      .order("created_at", { ascending: true });

    setNotes((data ?? []) as Note[]);
    setLoading(false);
  }

  async function addNote(html: string) {
    setSaving(true);
    const { data } = await supabase
      .from("dashboard_notes")
      .insert({ tenant_id: tenantId, content: html })
      .select("id, content, completed, created_at")
      .single();
    if (data) setNotes((prev) => [...prev, data as Note]);
    setSaving(false);
    setModalOpen(false);
  }

  async function toggleNote(note: Note) {
    const next = !note.completed;
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, completed: next } : n)));
    await supabase.from("dashboard_notes").update({ completed: next }).eq("id", note.id);
  }

  async function deleteNote(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    await supabase.from("dashboard_notes").delete().eq("id", id);
  }

  return (
    <div className="rounded-2xl border border-border bg-panel p-4">
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-muted" />
          <span className="text-base font-semibold">Σημειωματάριο</span>
          <span className="text-xs text-muted">(σήμερα)</span>
        </div>
        <button
          className="btn btn-primary text-xs inline-flex items-center gap-1.5 py-1.5 px-3"
          onClick={() => setModalOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Νέα σημείωση
        </button>
      </div>

      {/* Notes list */}
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted" />
        </div>
      ) : notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
          <StickyNote className="h-8 w-8 text-muted/40" />
          <div className="text-sm text-muted">Δεν υπάρχουν σημειώσεις για σήμερα.</div>
          <button
            className="text-xs text-primary underline underline-offset-2 hover:no-underline"
            onClick={() => setModalOpen(true)}
          >
            Πρόσθεσε την πρώτη σημείωση
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <NoteItem
              key={note.id}
              note={note}
              onToggle={() => toggleNote(note)}
              onDelete={() => deleteNote(note.id)}
            />
          ))}
        </div>
      )}

      <NoteEditorModal
        open={modalOpen}
        saving={saving}
        onClose={() => setModalOpen(false)}
        onSave={addNote}
      />
    </div>
  );
}

function NoteItem({
  note,
  onToggle,
  onDelete,
}: {
  note: Note;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border bg-bg px-3 py-2.5 transition-opacity ${
        note.completed ? "border-border/10 opacity-60" : "border-border"
      }`}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={note.completed}
        onChange={onToggle}
        className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-primary"
      />

      {/* Content */}
      <div
        className={`note-content flex-1 text-sm min-w-0 ${note.completed ? "line-through" : ""}`}
        dangerouslySetInnerHTML={{ __html: note.content }}
      />

      {/* Delete */}
      <button
        onClick={onDelete}
        className="shrink-0 mt-0.5 h-6 w-6 inline-flex items-center justify-center rounded-full text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
        title="Διαγραφή"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

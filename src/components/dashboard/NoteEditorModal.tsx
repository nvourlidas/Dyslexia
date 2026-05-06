import React, { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import {
  Bold, Italic, Underline as UnderlineIcon,
  List, ListOrdered, X, Heading2,
} from "lucide-react";

type Props = {
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (html: string) => Promise<void>;
};

function ToolbarBtn({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={`h-7 w-7 inline-flex items-center justify-center rounded transition-colors ${
        active
          ? "bg-primary/20 text-primary"
          : "text-muted hover:bg-border/10 hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

export default function NoteEditorModal({ open, saving, onClose, onSave }: Props) {
  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: "",
    editorProps: {
      attributes: {
        class: "note-editor-content min-h-[130px] outline-none",
      },
    },
  });

  useEffect(() => {
    if (open && editor) {
      editor.commands.setContent("");
      setTimeout(() => editor.commands.focus(), 50);
    }
  }, [open, editor]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const handleSave = async () => {
    if (!editor) return;
    const html = editor.getHTML();
    const isEmpty = html === "<p></p>" || html.trim() === "";
    if (isEmpty) return;
    await onSave(html);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-lg rounded-xl border border-border/10 bg-panel text-text shadow-xl">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/10 bg-panel px-4 py-3 rounded-t-xl">
            <div className="font-semibold text-sm">Νέα Σημείωση</div>
            <button
              onClick={onClose}
              disabled={saving}
              className="rounded px-2 py-1 hover:bg-border/10 disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4">
            {/* Toolbar */}
            <div className="flex items-center gap-0.5 mb-2 pb-2 border-b border-border/15 flex-wrap">
              <ToolbarBtn
                active={editor?.isActive("bold") ?? false}
                onClick={() => editor?.chain().focus().toggleBold().run()}
                title="Bold (Ctrl+B)"
              >
                <Bold className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <ToolbarBtn
                active={editor?.isActive("italic") ?? false}
                onClick={() => editor?.chain().focus().toggleItalic().run()}
                title="Italic (Ctrl+I)"
              >
                <Italic className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <ToolbarBtn
                active={editor?.isActive("underline") ?? false}
                onClick={() => editor?.chain().focus().toggleUnderline().run()}
                title="Underline (Ctrl+U)"
              >
                <UnderlineIcon className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <ToolbarBtn
                active={editor?.isActive("heading", { level: 2 }) ?? false}
                onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                title="Heading"
              >
                <Heading2 className="h-3.5 w-3.5" />
              </ToolbarBtn>

              <div className="w-px h-4 bg-border/20 mx-1" />

              <ToolbarBtn
                active={editor?.isActive("bulletList") ?? false}
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
                title="Bullet list"
              >
                <List className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <ToolbarBtn
                active={editor?.isActive("orderedList") ?? false}
                onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                title="Numbered list"
              >
                <ListOrdered className="h-3.5 w-3.5" />
              </ToolbarBtn>
            </div>

            {/* Editor area */}
            <div className="min-h-[130px] rounded-lg border border-border/15 bg-bg px-3 py-2 text-sm">
              <EditorContent editor={editor} />
            </div>

            {/* Actions */}
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn btn-secondary text-sm" onClick={onClose} disabled={saving}>
                Ακύρωση
              </button>
              <button className="btn btn-primary text-sm" onClick={handleSave} disabled={saving}>
                {saving ? "Αποθήκευση..." : "Αποθήκευση"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

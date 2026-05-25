// src/components/sessions/SessionPdfPreviewModal.tsx
import { useEffect, useState } from "react";
import { Loader2, Download, Printer } from "lucide-react";
import { generateSessionPdf, downloadSessionPdf, getSessionPdfDataUrl } from "@/lib/SessionPdfExport";
import type { TeacherDayGroup } from "@/types/session";

export default function SessionPdfPreviewModal({
  open,
  dateLabel,
  groups,
  onClose,
}: {
  open: boolean;
  dateLabel: string;
  groups: TeacherDayGroup[];
  onClose: () => void;
}) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pdfDoc, setPdfDoc] = useState<any>(null);

  useEffect(() => {
    if (!open) { setPdfUrl(null); setPdfDoc(null); return; }
    let cancelled = false;

    async function build() {
      setLoading(true);
      try {
        const doc = await generateSessionPdf(dateLabel, groups);
        if (cancelled) return;
        setPdfDoc(doc);
        setPdfUrl(getSessionPdfDataUrl(doc));
      } catch (e) {
        console.error("PDF generation error:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    build();
    return () => { cancelled = true; };
  }, [open, dateLabel, groups]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-panel border-b border-border/10 shrink-0">
        <div className="font-semibold text-sm">Προεπισκόπηση PDF — {dateLabel}</div>
        <div className="flex items-center gap-2">
          {pdfDoc && (
            <>
              <button
                className="h-8 px-3 rounded-md text-xs border border-border/15 hover:bg-panel2 inline-flex items-center gap-1.5 cursor-pointer"
                onClick={() => downloadSessionPdf(pdfDoc, dateLabel)}
              >
                <Download className="h-3.5 w-3.5" />
                Λήψη PDF
              </button>
              <button
                className="h-8 px-3 rounded-md text-xs bg-primary text-white hover:bg-primary/90 inline-flex items-center gap-1.5 cursor-pointer"
                onClick={() => {
                  const url = pdfDoc.output("bloburl");
                  window.open(url, "_blank");
                }}
              >
                <Printer className="h-3.5 w-3.5" />
                Εκτύπωση
              </button>
            </>
          )}
          <button
            className="h-8 px-3 rounded-md text-xs border border-border/15 hover:bg-panel2 cursor-pointer"
            onClick={onClose}
          >
            Κλείσιμο
          </button>
        </div>
      </div>

      {/* Full screen preview */}
      <div className="flex-1 overflow-hidden bg-[#404040] flex items-center justify-center">
        {loading && (
          <div className="flex flex-col items-center gap-3 text-white/60">
            <Loader2 className="h-10 w-10 animate-spin" />
            <span className="text-sm">Δημιουργία PDF…</span>
          </div>
        )}
        {!loading && pdfUrl && (
          <iframe
            src={pdfUrl}
            className="w-full h-full border-0"
            title="PDF Preview"
          />
        )}
        {!loading && !pdfUrl && (
          <div className="text-sm text-white/60">Αποτυχία δημιουργίας PDF.</div>
        )}
      </div>
    </div>
  );
}

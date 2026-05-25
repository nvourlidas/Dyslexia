// src/lib/SessionPdfExport.ts
import jsPDF from "jspdf";
import { toTimeStr } from "@/lib/session.utils";
import { registerNotoSansFonts } from "@/lib/pdfFonts";
import notoSansUrl from "@/assets/fonts/NotoSans-Regular.ttf?url";
import notoSansBoldUrl from "@/assets/fonts/NotoSans-Bold.ttf?url";
import type { TeacherDayGroup } from "@/types/session";

const PALETTE_RGB: [number, number, number][] = [
  [230, 241, 251],
  [225, 245, 238],
  [250, 238, 218],
  [251, 234, 240],
  [238, 237, 254],
  [250, 236, 231],
];

const PALETTE_TEXT_RGB: [number, number, number][] = [
  [12, 68, 124],
  [8, 80, 65],
  [99, 56, 6],
  [75, 21, 40],
  [60, 52, 137],
  [113, 43, 19],
];

export async function generateSessionPdf(
  dateLabel: string,
  groups: TeacherDayGroup[]
): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  await registerNotoSansFonts(doc, notoSansUrl, notoSansBoldUrl);

  const pageWidth = doc.internal.pageSize.getWidth();   // 297mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210mm
  const margin = 8;
  const usableWidth = pageWidth - margin * 2;

  // Title
  doc.setFont("NotoSans", "bold");
  doc.setFontSize(13);
  doc.setTextColor(30, 30, 30);
  doc.text(`Πρόγραμμα — ${dateLabel}`, margin, margin + 5);

  if (groups.length === 0) {
    doc.setFont("NotoSans", "normal");
    doc.setFontSize(10);
    doc.text("Δεν υπάρχουν sessions για αυτή την ημέρα.", margin, 30);
    return doc;
  }

  // Each teacher gets 2 columns: [ώρα | μαθητής]
  // Total columns = groups.length * 2
  // We split usable width equally per teacher pair
  const pairWidth = usableWidth / groups.length;
  const timeColW = pairWidth * 0.38;  // 38% for time
  const nameColW = pairWidth * 0.62;  // 62% for student name

  // ── Head: teacher names spanning 2 cols each ──────────────────────────────
  // autoTable doesn't support colspan in head easily, so we draw teachers
  // manually and use autoTable only for data rows.

  const tableStartY = margin + 10;
  const headerH = 9;
  const rowH = 7;

  // Find max slots across all teachers
  const maxSlots = Math.max(...groups.map((g) => g.slots.length));

  groups.forEach((g, gi) => {
    const x = margin + gi * pairWidth;
    const bgRgb = PALETTE_RGB[g.colorIdx % PALETTE_RGB.length];
    const textRgb = PALETTE_TEXT_RGB[g.colorIdx % PALETTE_TEXT_RGB.length];

    // ── Teacher header (spans both sub-columns) ───────────────────────────
    doc.setFillColor(bgRgb[0], bgRgb[1], bgRgb[2]);
    doc.rect(x, tableStartY, pairWidth - 1, headerH, "F");
    doc.setDrawColor(200, 200, 200);
    doc.rect(x, tableStartY, pairWidth - 1, headerH, "S");

    doc.setFont("NotoSans", "bold");
    doc.setFontSize(8);
    doc.setTextColor(textRgb[0], textRgb[1], textRgb[2]);
    // Teacher name
    doc.text(g.teacher_name, x + 2, tableStartY + 5, { maxWidth: pairWidth - 4 });
    // Hours range
    if (g.slots.length > 0) {
      const firstStart = toTimeStr(g.slots[0].starts_at);
      const lastEnd = toTimeStr(g.slots[g.slots.length - 1].ends_at);
      doc.setFont("NotoSans", "normal");
      doc.setFontSize(6.5);
      doc.text(`${firstStart} – ${lastEnd}`, x + 2, tableStartY + 8.5);
    }

    // ── Sub-header: Ώρα | Μαθητής ────────────────────────────────────────
    const subHeaderY = tableStartY + headerH;
    const subH = 5.5;

    doc.setFillColor(245, 245, 245);
    doc.rect(x, subHeaderY, timeColW, subH, "F");
    doc.rect(x + timeColW, subHeaderY, nameColW - 1, subH, "F");
    doc.setDrawColor(200, 200, 200);
    doc.rect(x, subHeaderY, timeColW, subH, "S");
    doc.rect(x + timeColW, subHeaderY, nameColW - 1, subH, "S");

    doc.setFont("NotoSans", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(100, 100, 100);
    doc.text("Ώρα", x + 1.5, subHeaderY + 3.8);
    doc.text("Μαθητής", x + timeColW + 1.5, subHeaderY + 3.8);

    // ── Slot rows ─────────────────────────────────────────────────────────
    const dataStartY = subHeaderY + subH;

    g.slots.forEach((slot, si) => {
      const y = dataStartY + si * rowH;

      // Alternate row bg
      const fillColor: [number, number, number] = si % 2 === 0 ? [255, 255, 255] : [250, 250, 250];
      doc.setFillColor(...fillColor);
      doc.rect(x, y, timeColW, rowH, "F");
      doc.rect(x + timeColW, y, nameColW - 1, rowH, "F");

      // Borders
      doc.setDrawColor(220, 220, 220);
      doc.rect(x, y, timeColW, rowH, "S");
      doc.rect(x + timeColW, y, nameColW - 1, rowH, "S");

      // Time — single line "13:30-14:15"
      const startT = toTimeStr(slot.starts_at);
      const endT = toTimeStr(slot.ends_at);
      doc.setFont("NotoSans", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(60, 60, 60);
      doc.text(`${startT}-${endT}`, x + 1.5, y + rowH / 2 + 2);

      // Student name
      const ss = slot.class_session_students?.[0];
      const studentName = ss?.student
        ? `${ss.student.lastname} ${ss.student.name}`
        : "—";

      doc.setFont("NotoSans", "normal");
      doc.setFontSize(8);
      doc.setTextColor(30, 30, 30);
      doc.text(studentName, x + timeColW + 1.5, y + 4.5, { maxWidth: nameColW - 3 });
    });

    // Fill empty rows to align all columns
    const filledRows = g.slots.length;
    for (let si = filledRows; si < maxSlots; si++) {
      const y = dataStartY + si * rowH;
      doc.setFillColor(255, 255, 255);
      doc.rect(x, y, timeColW, rowH, "F");
      doc.rect(x + timeColW, y, nameColW - 1, rowH, "F");
      doc.setDrawColor(230, 230, 230);
      doc.rect(x, y, timeColW, rowH, "S");
      doc.rect(x + timeColW, y, nameColW - 1, rowH, "S");
    }
  });

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(160, 160, 160);
  doc.setFont("NotoSans", "normal");
  doc.text(
    `Εκτυπώθηκε: ${new Date().toLocaleDateString("el-GR")}`,
    margin,
    pageHeight - 4
  );

  return doc;
}

export function downloadSessionPdf(doc: jsPDF, dateLabel: string) {
  const filename = `προγραμμα_${dateLabel.replace(/\s/g, "_")}.pdf`;
  doc.save(filename);
}

export function getSessionPdfDataUrl(doc: jsPDF): string {
  return doc.output("datauristring");
}

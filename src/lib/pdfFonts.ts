// src/lib/pdfFonts.ts
import jsPDF from "jspdf";

/**
 * Loads a TTF file and registers it inside jsPDF
 */
async function loadTtfAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();

  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return btoa(binary);
}

/**
 * Registers regular + bold fonts in a jsPDF instance
 */
export async function registerNotoSansFonts(
  doc: jsPDF,
  regularUrl: string,
  boldUrl: string,
) {
  const regular64 = await loadTtfAsBase64(regularUrl);
  doc.addFileToVFS("NotoSans-Regular.ttf", regular64);
  doc.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");

  const bold64 = await loadTtfAsBase64(boldUrl);
  doc.addFileToVFS("NotoSans-Bold.ttf", bold64);
  doc.addFont("NotoSans-Bold.ttf", "NotoSans", "bold");
}
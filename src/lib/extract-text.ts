/**
 * Client-side text extraction from PDF and DOCX files.
 * Used by the worksheet creation flow to extract source material for ClassMate AI.
 */

/**
 * Extract plain text from a PDF file using pdf.js (main-thread, no web worker).
 * For worksheet source material (<10MB), main-thread processing is fast enough.
 */
async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  // Disable web worker — run on main thread. Fine for <10MB files.
  pdfjsLib.GlobalWorkerOptions.workerSrc = "";

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({
    data: arrayBuffer,
    useWorkerFetch: false,
    useSystemFonts: true,
  }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    if (text.trim()) pages.push(text.trim());
  }

  return pages.join("\n\n");
}

/**
 * Extract plain text from a DOCX file using mammoth.
 */
async function extractDocxText(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

/**
 * Supported worksheet source material file extensions.
 */
export const WORKSHEET_ACCEPTED_EXTENSIONS = ".txt,.md,.pdf,.docx";

/**
 * Check if a file is a supported worksheet source material type.
 */
export function isWorksheetAcceptedFile(file: File): boolean {
  return /\.(txt|md|pdf|docx)$/i.test(file.name);
}

/**
 * Extract plain text from a file.
 * Supports: .txt, .md (raw text), .pdf (pdf.js), .docx (mammoth).
 * Falls back to file.text() for unknown text-based types.
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf")) {
    return extractPdfText(file);
  }

  if (name.endsWith(".docx")) {
    return extractDocxText(file);
  }

  // .txt, .md, and other text-based files
  return file.text();
}

// MSU-IIT College of Education (CED) programs — scraped from msuiit.edu.ph
// Departments: SME, PRE, PE, TTE

export type CEDDepartment = "SME" | "PRE" | "PE" | "TTE";

export interface CEDProgram {
  name: string;
  department: CEDDepartment;
  /** true = 4-year bachelor's; false = shorter certificate */
  bachelor: boolean;
}

export const CED_DEPARTMENT_LABELS: Record<CEDDepartment, string> = {
  SME: "Science & Mathematics Education",
  PRE: "Professional Education",
  PE: "Physical Education",
  TTE: "Technology Teacher Education",
};

export const CED_PROGRAMS: CEDProgram[] = [
  // ── SME ───────────────────────────────────────────
  { name: "BSED – Science and Mathematics", department: "SME", bachelor: true },
  { name: "BSED – Biology", department: "SME", bachelor: true },
  { name: "BSED – Chemistry", department: "SME", bachelor: true },
  { name: "BSED – Physics", department: "SME", bachelor: true },
  { name: "BSED – Mathematics", department: "SME", bachelor: true },
  // ── PRE ──────────────────────────────────────────
  { name: "BEEd – Language Education", department: "PRE", bachelor: true },
  { name: "BSED – Filipino", department: "PRE", bachelor: true },
  { name: "Certificate in Professional Teaching", department: "PRE", bachelor: false },
  // ── PE ───────────────────────────────────────────
  { name: "Bachelor of Physical Education", department: "PE", bachelor: true },
  // ── TTE ──────────────────────────────────────────
  { name: "BTLED – Home Economics", department: "TTE", bachelor: true },
  { name: "BTVTED – Drafting Technology", department: "TTE", bachelor: true },
  { name: "BTLED – Industrial Arts", department: "TTE", bachelor: true },
] as const;

/** Short label for display in cards/tabs (removes "Bachelor of" / "BSED – " prefix noise). */
export function programShort(p: CEDProgram): string {
  return p.name;
}

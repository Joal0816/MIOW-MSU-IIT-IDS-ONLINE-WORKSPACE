// Parser for the strict four-section worksheet format produced by the
// ClassMate assistant (and the legacy "Question | A, B, C, D | answer"
// one-line format, kept as a fallback).
//
// Expected format (markdown-tolerant — headings, **bold**, and bullets are
// stripped before parsing):
//
//   Section I: Multiple Choice
//   Instructions: ...
//   1. Stem
//   A. Option
//   ...
//   Section II: Fill in the Blank
//   3. Sentence with ______ .
//   Section III: Matching Type
//   Column A:
//   5. Premise
//   Column B:
//   A. Definition
//   Section IV: Essay / Short Answer
//   8. Prompt
//   Answer Key:
//   1. B - explanation
//   3. Photosynthesis (Acceptable: carbon assimilation)
//   8. Rubric/Key Points: ...

export type ParsedQuestionKind = "mc" | "fill" | "matching" | "essay";

export interface ParsedQuestion {
  question: string;
  options: string[];
  /** Primary correct answer; acceptable variants joined with "||". Essays are prefixed "Rubric: ". */
  correct_answer: string;
  kind: ParsedQuestionKind;
}

export interface ParseResult {
  questions: ParsedQuestion[];
  /** Items that looked like questions but were unusable (missing options or key). */
  dropped: number;
}

/** Strip markdown decoration so copied chat output parses cleanly. */
function clean(line: string): string {
  return line
    .replace(/^#{1,6}\s*/, "")
    .replace(/^>\s?/, "")
    .replace(/^[-*•]\s+(?=[A-Za-z][.)]\s)/, "") // bullet before a lettered option ("- A. ...")
    .replace(/\*\*/g, "")
    .trim();
}

const ITEM_RE = /^(\d{1,3})[.)]\s+(.+)$/;
const OPT_RE = /^([A-Z])[.)]\s+(.+)$/;

function splitInlineItems(line: string): Array<{ num: number; text: string }> {
  const matches = [...line.matchAll(/(?:^|\s)(\d{1,3})[.)]\s+(.+?)(?=\s+\d{1,3}[.)]\s+|$)/g)];
  return matches.map((match) => ({ num: Number(match[1]), text: match[2]!.trim() }));
}

function splitInlineOptions(line: string): Array<{ letter: string; text: string }> {
  const matches = [...line.matchAll(/(?:^|\s)([A-Z])[.)]\s+(.+?)(?=\s+[A-Z][.)]\s+|$)/g)];
  return matches.map((match) => ({ letter: match[1]!, text: match[2]!.trim() }));
}

function detectSection(line: string): ParsedQuestionKind | null {
  const l = line.toLowerCase();
  if (
    /^section\s+[ivx1-4]+[\s:—–-]/.test(l) ||
    /^(multiple choice|fill in the blank|matching type|essay\s*\/\s*short answer)$/.test(l)
  ) {
    if (/multiple choice/.test(l) || /section\s+(i|1)[\s:—–-]/.test(l)) return "mc";
    if (/fill in the blank/.test(l) || /section\s+(ii|2)[\s:—–-]/.test(l)) return "fill";
    if (/matching/.test(l) || /section\s+(iii|3)[\s:—–-]/.test(l)) return "matching";
    if (/essay|short answer/.test(l) || /section\s+(iv|4)[\s:—–-]/.test(l)) return "essay";
  }
  return null;
}

interface KeyEntry {
  letter?: string; // MC / matching
  primary?: string; // fill in the blank
  acceptable: string[]; // fill in the blank synonyms
  rubric?: string; // essay
}

function parseKeyEntry(body: string): KeyEntry {
  const rubric =
    body.match(/^rubric\/?\s*key points?\s*:?\s*(.*)$/i) ?? body.match(/^rubric\s*:?\s*(.*)$/i);
  if (rubric) return { rubric: rubric[1]!.trim(), acceptable: [] };
  const letter = body.match(/^([A-Z])\s*(?:[-–—:.]|\s|$)\s*(.*)$/);
  if (letter) return { letter: letter[1]!, acceptable: [] };
  const acceptableMatch = body.match(/\(acceptable:\s*([^)]*)\)/i);
  const acceptable = acceptableMatch
    ? acceptableMatch[1]!
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const primary = body
    .replace(/\(acceptable:\s*[^)]*\)/i, "")
    .replace(/[-–—]\s*$/, "")
    .trim();
  return { primary, acceptable };
}

/** True when the text uses the four-section worksheet format. */
export function looksLikeWorksheet(text: string): boolean {
  return text.split("\n").some((raw) => detectSection(clean(raw)) !== null);
}

export function parseWorksheet(text: string): ParseResult {
  const lines = text.split("\n").map(clean);

  // Split body vs answer key.
  const keyStart = lines.findIndex((l) => /^answer key\b/i.test(l));
  const bodyLines = keyStart >= 0 ? lines.slice(0, keyStart) : lines;
  const keyLines = keyStart >= 0 ? lines.slice(keyStart + 1) : [];

  // Answer key entries by item number.
  const keyByNum = new Map<number, KeyEntry>();
  const unnumberedKeys: KeyEntry[] = [];
  for (const line of keyLines) {
    const m = line.match(ITEM_RE);
    if (m) keyByNum.set(parseInt(m[1]!, 10), parseKeyEntry(m[2]!));
    else if (line) unnumberedKeys.push(parseKeyEntry(line));
  }

  // Walk the body.
  type McItem = { num: number; stem: string; options: string[] };
  const mcItems: McItem[] = [];
  const fillItems: Array<{ num: number; stem: string }> = [];
  const essayItems: Array<{ num: number; stem: string }> = [];
  const premises: Array<{ num: number; text: string }> = [];
  const columnB: Array<{ letter: string; text: string }> = [];

  let section: ParsedQuestionKind | null = null;
  let column: "A" | "B" | null = null;
  let currentMc: McItem | null = null;
  let lastStem: { num: number; stem: string } | null = null;
  let nextAutoNum = 1;

  const reserveNumber = (explicit?: number) => {
    if (explicit != null) {
      nextAutoNum = Math.max(nextAutoNum, explicit + 1);
      return explicit;
    }
    return nextAutoNum++;
  };

  for (const line of bodyLines) {
    if (!line) continue;
    if (/^instructions?\s*:/i.test(line)) continue;
    if (/^table of specifications|^tos\b/i.test(line)) break;

    const next = detectSection(line);
    if (next) {
      section = next;
      column = null;
      currentMc = null;
      lastStem = null;
      continue;
    }
    if (!section) continue;

    if (section === "matching") {
      const columnAHeader = line.match(/^column\s*a\s*:\s*(.*)$/i);
      if (columnAHeader) {
        column = "A";
        for (const item of splitInlineItems(columnAHeader[1] ?? "")) {
          premises.push({ num: reserveNumber(item.num), text: item.text });
        }
        continue;
      }
      const columnBHeader = line.match(/^column\s*b\s*:\s*(.*)$/i);
      if (columnBHeader) {
        column = "B";
        for (const option of splitInlineOptions(columnBHeader[1] ?? "")) columnB.push(option);
        continue;
      }
      const item = line.match(ITEM_RE);
      if (item && column !== "B") {
        premises.push({ num: reserveNumber(parseInt(item[1]!, 10)), text: item[2]!.trim() });
        continue;
      }
      const opt = line.match(OPT_RE);
      if (opt && (column === "B" || column === null)) {
        column = "B";
        columnB.push({ letter: opt[1]!, text: opt[2]!.trim() });
      }
      continue;
    }

    const item = line.match(ITEM_RE);
    if (item) {
      const num = reserveNumber(parseInt(item[1]!, 10));
      if (section === "mc") {
        currentMc = { num, stem: item[2]!.trim(), options: [] };
        mcItems.push(currentMc);
        lastStem = null;
      } else {
        const entry = { num, stem: item[2]!.trim() };
        (section === "fill" ? fillItems : essayItems).push(entry);
        lastStem = entry;
        currentMc = null;
      }
      continue;
    }

    // Also accept natural copied output where each MC question and its four
    // choices are on one line, without an item number.
    if (section === "mc") {
      const options = splitInlineOptions(line);
      if (options.length >= 2) {
        const firstOption = line.search(/(?:^|\s)[A-Z][.)]\s+/);
        const stem = line.slice(0, firstOption).trim();
        if (stem) {
          currentMc = { num: reserveNumber(), stem, options: options.map((option) => option.text) };
          mcItems.push(currentMc);
          continue;
        }
      }
    }

    // Fill and essay prompts are commonly copied as unnumbered paragraphs.
    if (section === "fill" && /_{3,}/.test(line)) {
      const entry = { num: reserveNumber(), stem: line };
      fillItems.push(entry);
      lastStem = entry;
      continue;
    }
    if (section === "essay") {
      const entry = { num: reserveNumber(), stem: line };
      essayItems.push(entry);
      lastStem = entry;
      continue;
    }

    const opt = line.match(OPT_RE);
    if (section === "mc" && opt && currentMc) {
      currentMc.options.push(opt[2]!.trim());
      continue;
    }

    // Continuation of a wrapped stem.
    if (lastStem && section !== "mc") lastStem.stem += " " + line;
    else if (currentMc && !opt) currentMc.stem += " " + line;
  }

  // If the body omitted item numbers, pair answer-key entries with body items
  // in worksheet order. Explicitly numbered keys always take precedence.
  const orderedItemNumbers = [
    ...mcItems.map((item) => item.num),
    ...fillItems.map((item) => item.num),
    ...premises.map((item) => item.num),
    ...essayItems.map((item) => item.num),
  ];
  let unnumberedIndex = 0;
  for (const num of orderedItemNumbers) {
    if (!keyByNum.has(num) && unnumberedKeys[unnumberedIndex]) {
      keyByNum.set(num, unnumberedKeys[unnumberedIndex]!);
      unnumberedIndex += 1;
    }
  }

  const questions: ParsedQuestion[] = [];
  let dropped = 0;
  const letterIdx = (letter?: string) => (letter ? letter.toUpperCase().charCodeAt(0) - 65 : -1);

  for (const item of mcItems) {
    const key = keyByNum.get(item.num);
    const idx = letterIdx(key?.letter);
    const correct = idx >= 0 ? item.options[idx] : undefined;
    if (item.options.length >= 2 && correct) {
      questions.push({
        question: item.stem,
        options: item.options,
        correct_answer: correct,
        kind: "mc",
      });
    } else dropped += 1;
  }

  for (const item of fillItems) {
    const key = keyByNum.get(item.num);
    if (key?.primary) {
      const variants = [key.primary, ...key.acceptable].filter(Boolean);
      questions.push({
        question: item.stem,
        options: [],
        correct_answer: variants.join("||"),
        kind: "fill",
      });
    } else dropped += 1;
  }

  for (const premise of premises) {
    const key = keyByNum.get(premise.num);
    const idx = letterIdx(key?.letter);
    const correct = idx >= 0 ? columnB[idx]?.text : undefined;
    if (columnB.length >= 2 && correct) {
      questions.push({
        question: premise.text,
        options: columnB.map((o) => o.text),
        correct_answer: correct,
        kind: "matching",
      });
    } else dropped += 1;
  }

  for (const item of essayItems) {
    const key = keyByNum.get(item.num);
    const rubric = key?.rubric ?? key?.primary ?? "Teacher review against the discussed concepts.";
    questions.push({
      question: item.stem,
      options: [],
      correct_answer: `Rubric: ${rubric}`,
      kind: "essay",
    });
  }

  // Legacy fallback: one question per line — "Question | A, B, C, D | answer".
  if (questions.length === 0 && dropped === 0) {
    for (const raw of text.split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      const [question, opts, correct] = line.split("|").map((s) => s.trim());
      const options = (opts ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (question && options.length >= 2 && correct) {
        questions.push({ question, options, correct_answer: correct, kind: "mc" });
      } else if (question) dropped += 1;
    }
  }

  return { questions, dropped };
}

import { describe, it, expect } from "bun:test";
import { parseWorksheet, looksLikeWorksheet } from "./worksheet-parser";

// ── looksLikeWorksheet ──────────────────────────────────────────────

describe("looksLikeWorksheet", () => {
  it("returns true for text with Section I", () => {
    expect(looksLikeWorksheet("Section I: Multiple Choice")).toBe(true);
  });

  it("returns true for text with Section II", () => {
    expect(looksLikeWorksheet("Section II: Fill in the Blank")).toBe(true);
  });

  it("returns true for section headings in roman numerals", () => {
    expect(looksLikeWorksheet("SECTION III: Matching Type")).toBe(true);
  });

  it("returns true for named section headings", () => {
    expect(looksLikeWorksheet("Essay / Short Answer")).toBe(true);
  });

  it("returns false for plain text", () => {
    expect(looksLikeWorksheet("Just a normal paragraph.")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(looksLikeWorksheet("")).toBe(false);
  });
});

// ── parseWorksheet — Multiple Choice ────────────────────────────────

describe("parseWorksheet — multiple choice", () => {
  it("parses numbered MC questions with lettered options", () => {
    const text = `
Section I: Multiple Choice
1. What is 2 + 2?
A. 3
B. 4
C. 5
D. 6

2. What is the capital of France?
A. London
B. Berlin
C. Paris
D. Madrid

Answer Key:
1. B
2. C
`;
    const result = parseWorksheet(text);
    expect(result.questions).toHaveLength(2);
    expect(result.dropped).toBe(0);

    const q1 = result.questions[0]!;
    expect(q1.question).toBe("What is 2 + 2?");
    expect(q1.options).toEqual(["3", "4", "5", "6"]);
    expect(q1.correct_answer).toBe("4");
    expect(q1.kind).toBe("mc");

    const q2 = result.questions[1]!;
    expect(q2.correct_answer).toBe("Paris");
  });

  it("drops MC questions with fewer than 2 options", () => {
    const text = `
Section I: Multiple Choice
1. Incomplete?
A. Only one

Answer Key:
1. A
`;
    const result = parseWorksheet(text);
    expect(result.questions).toHaveLength(0);
    expect(result.dropped).toBe(1);
  });

  it("drops MC questions with no matching answer key", () => {
    const text = `
Section I: Multiple Choice
1. Unanswered?
A. X
B. Y

Answer Key:
`;
    const result = parseWorksheet(text);
    expect(result.questions).toHaveLength(0);
    expect(result.dropped).toBe(1);
  });
});

// ── parseWorksheet — Fill in the Blank ──────────────────────────────

describe("parseWorksheet — fill in the blank", () => {
  it("parses fill items with answer key", () => {
    const text = `
Section II: Fill in the Blank
3. The process by which plants make food is ______.

Answer Key:
3. Photosynthesis (Acceptable: carbon assimilation)
`;
    const result = parseWorksheet(text);
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0]!.kind).toBe("fill");
    expect(result.questions[0]!.correct_answer).toBe("Photosynthesis||carbon assimilation");
  });

  it("drops fill items with no answer key", () => {
    const text = `
Section II: Fill in the Blank
5. The answer is ______.

Answer Key:
`;
    const result = parseWorksheet(text);
    expect(result.questions).toHaveLength(0);
    expect(result.dropped).toBe(1);
  });
});

// ── parseWorksheet — Matching Type ──────────────────────────────────

describe("parseWorksheet — matching type", () => {
  it("parses matching questions with column A/B", () => {
    const text = `
Section III: Matching Type
Column A:
7. Largest planet
8. Closest star

Column B:
A. Sun
B. Jupiter
C. Earth

Answer Key:
7. B
8. A
`;
    const result = parseWorksheet(text);
    expect(result.questions).toHaveLength(2);
    const q1 = result.questions[0]!;
    const q2 = result.questions[1]!;
    expect(q1.kind).toBe("matching");
    expect(q1.question).toBe("Largest planet");
    expect(q1.options).toEqual(["Sun", "Jupiter", "Earth"]);
    expect(q1.correct_answer).toBe("Jupiter");
    expect(q2.correct_answer).toBe("Sun");
  });
});

// ── parseWorksheet — Essay ──────────────────────────────────────────

describe("parseWorksheet — essay", () => {
  it("parses essay questions with rubric", () => {
    const text = `
Section IV: Essay / Short Answer
10. Explain the water cycle.

Answer Key:
10. Rubric: Evaporation, condensation, precipitation
`;
    const result = parseWorksheet(text);
    expect(result.questions).toHaveLength(1);
    const q = result.questions[0]!;
    expect(q.kind).toBe("essay");
    expect(q.correct_answer).toBe("Rubric: Evaporation, condensation, precipitation");
  });

  it("uses default rubric when key is missing", () => {
    const text = `
Section IV: Essay / Short Answer
11. Discuss photosynthesis.

Answer Key:
`;
    const result = parseWorksheet(text);
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0]!.correct_answer).toContain("Rubric:");
  });
});

// ── parseWorksheet — Mixed sections ─────────────────────────────────

describe("parseWorksheet — mixed sections", () => {
  it("parses all four section types together", () => {
    const text = `
Section I: Multiple Choice
1. Capital of Japan?
A. Seoul
B. Tokyo
C. Beijing
D. Bangkok

Section II: Fill in the Blank
2. Water boils at ______ degrees Celsius.

Section III: Matching Type
Column A:
3. Na
Column B:
A. Sodium
B. Chlorine

Section IV: Essay / Short Answer
4. Explain gravity.

Answer Key:
1. B
2. 100
3. A
4. Rubric: Force of attraction between masses
`;
    const result = parseWorksheet(text);
    expect(result.questions).toHaveLength(4);
    expect(result.questions[0]!.kind).toBe("mc");
    expect(result.questions[1]!.kind).toBe("fill");
    expect(result.questions[2]!.kind).toBe("matching");
    expect(result.questions[3]!.kind).toBe("essay");
  });
});

// ── parseWorksheet — Markdown stripping ─────────────────────────────

describe("parseWorksheet — markdown stripping", () => {
  it("strips bold markers from stems and options", () => {
    const text = `
Section I: Multiple Choice
1. **What is** the answer?
A. **Option** one
B. Option two

Answer Key:
1. A
`;
    const result = parseWorksheet(text);
    const q = result.questions[0]!;
    expect(q.question).toBe("What is the answer?");
    expect(q.options[0]).toBe("Option one");
  });

  it("strips heading markers", () => {
    const text = `
## Section I: Multiple Choice
1. Question?
A. Yes
B. No

Answer Key:
1. A
`;
    const result = parseWorksheet(text);
    expect(result.questions).toHaveLength(1);
  });
});

// ── parseWorksheet — Legacy pipe format ─────────────────────────────

describe("parseWorksheet — legacy pipe format", () => {
  it("parses pipe-delimited MC questions", () => {
    const text = `What is 2+2? | 3, 4, 5, 6 | 4
Capital of France? | London, Berlin, Paris | Paris`;
    const result = parseWorksheet(text);
    expect(result.questions).toHaveLength(2);
    expect(result.questions[0]!.correct_answer).toBe("4");
    expect(result.questions[1]!.correct_answer).toBe("Paris");
  });

  it("drops legacy lines with fewer than 2 options", () => {
    const text = `Incomplete? | only one | answer`;
    const result = parseWorksheet(text);
    expect(result.questions).toHaveLength(0);
    expect(result.dropped).toBe(1);
  });
});

// ── parseWorksheet — Edge cases ─────────────────────────────────────

describe("parseWorksheet — edge cases", () => {
  it("returns empty for empty input", () => {
    const result = parseWorksheet("");
    expect(result.questions).toHaveLength(0);
    expect(result.dropped).toBe(0);
  });

  it("ignores instructions lines", () => {
    const text = `
Section I: Multiple Choice
Instructions: Choose the best answer.
1. Q?
A. A
B. B

Answer Key:
1. B
`;
    const result = parseWorksheet(text);
    expect(result.questions).toHaveLength(1);
  });

  it("stops parsing at Table of Specifications", () => {
    const text = `
Section I: Multiple Choice
1. Q?
A. A
B. B

Table of Specifications
This should be ignored.

Answer Key:
1. B
`;
    const result = parseWorksheet(text);
    // TOS encountered mid-section — the pending MC question IS saved
    // (it was completed before TOS appeared), so dropped is 0.
    expect(result.questions.length).toBe(1);
    expect(result.dropped).toBe(0);
  });

  it("handles case-insensitive section headings", () => {
    const text = `
SECTION I: MULTIPLE CHOICE
1. Hello?
A. Hi
B. Hey

Answer Key:
1. A
`;
    const result = parseWorksheet(text);
    expect(result.questions).toHaveLength(1);
  });

  it("handles section headings with em-dash separator", () => {
    const text = `
Section I — Multiple Choice
1. Q?
A. X
B. Y

Answer Key:
1. A
`;
    const result = parseWorksheet(text);
    expect(result.questions).toHaveLength(1);
  });
});

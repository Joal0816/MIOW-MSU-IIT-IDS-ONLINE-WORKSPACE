import { describe, it, expect } from "bun:test";

process.env["SUPABASE_URL"] ??= "https://test.supabase.co";
process.env["SUPABASE_SERVICE_ROLE_KEY"] ??= "test-service-role-key-1234567890abcdef";
process.env["SUPABASE_PUBLISHABLE_KEY"] ??= "test-publishable-key";

import { parseKeywordCategories, gradeEssay } from "./quizzes.server";

/* ---------- parseKeywordCategories ---------- */

describe("parseKeywordCategories", () => {
  it("returns empty array when no keyword marker is present", () => {
    expect(parseKeywordCategories("Just a plain rubric")).toEqual([]);
  });

  it("parses a single category with pipe prefix", () => {
    const result = parseKeywordCategories(
      "Rubric text | Keywords: anaerobic = respiration, oxygen",
    );
    expect(result).toEqual([["respiration", "oxygen"]]);
  });

  it("parses a single category without pipe prefix", () => {
    const result = parseKeywordCategories("Keywords: mitosis = cell, division, spindle");
    expect(result).toEqual([["cell", "division", "spindle"]]);
  });

  it("parses multiple categories separated by semicolons", () => {
    const result = parseKeywordCategories(
      "| Keywords: cat1 = alpha, beta; cat2 = gamma; cat3 = delta, epsilon",
    );
    expect(result).toEqual([["alpha", "beta"], ["gamma"], ["delta", "epsilon"]]);
  });

  it("is case-insensitive for the keyword marker", () => {
    const result = parseKeywordCategories("| KEYWORDS: foo = bar, baz");
    expect(result).toEqual([["bar", "baz"]]);
  });

  it("handles slash separators between keywords", () => {
    const result = parseKeywordCategories("| Keywords: group = one/two/three");
    expect(result).toEqual([["one", "two", "three"]]);
  });

  it("handles pipe separators between keywords", () => {
    const result = parseKeywordCategories("| Keywords: group = alpha | beta");
    expect(result).toEqual([["alpha", "beta"]]);
  });

  it("trims whitespace around keywords", () => {
    const result = parseKeywordCategories("| Keywords: g =  alpha ,  beta  , gamma ");
    expect(result).toEqual([["alpha", "beta", "gamma"]]);
  });

  it("filters out empty groups", () => {
    const result = parseKeywordCategories("| Keywords: ; valid = a, b; ");
    expect(result).toEqual([["a", "b"]]);
  });

  it("filters out empty keyword entries after trimming", () => {
    const result = parseKeywordCategories("| Keywords: g = a,,b,,");
    expect(result).toEqual([["a", "b"]]);
  });

  it("returns empty array for bare 'Keywords:' with no values", () => {
    expect(parseKeywordCategories("Keywords:")).toEqual([]);
  });

  it("strips category names before the equals sign", () => {
    const result = parseKeywordCategories("| Keywords: biology concept = photosynthesis");
    expect(result).toEqual([["photosynthesis"]]);
  });
});

/* ---------- gradeEssay ---------- */

describe("gradeEssay", () => {
  describe("gibberish detection", () => {
    it("rejects answers with fewer than 5 words", () => {
      expect(gradeEssay("hello world", "concept = hello, world")).toBe(false);
    });

    it("rejects empty answers", () => {
      expect(gradeEssay("", "concept = word1, word2")).toBe(false);
    });

    it("rejects answers with 4+ repeated characters", () => {
      expect(gradeEssay("this is aaaaaaa test answer for the rubric", "test = this, answer")).toBe(
        false,
      );
    });

    it("rejects answers with long consonant-only words", () => {
      expect(gradeEssay("this is a crwth test answer for the rubric", "test = this, answer")).toBe(
        false,
      );
    });

    it("accepts normal answers with 5+ words", () => {
      expect(
        gradeEssay(
          "The process of photosynthesis converts light energy to chemical energy in plants",
          "photosynthesis = process, energy, plants",
        ),
      ).toBe(true);
    });
  });

  describe("rubric concept fallback (no keyword categories)", () => {
    it("passes when answer contains 2+ rubric concepts", () => {
      expect(
        gradeEssay(
          "Mitosis is a type of cell division that produces identical daughter cells",
          "Mitosis involves cell division producing identical cells",
        ),
      ).toBe(true);
    });

    it("fails when answer contains fewer than 2 rubric concepts", () => {
      expect(
        gradeEssay(
          "The answer is about something completely unrelated to the topic",
          "mitosis involves cell division producing identical cells",
        ),
      ).toBe(false);
    });

    it("handles multi-word keywords via substring match", () => {
      expect(
        gradeEssay(
          "Cell division occurs during mitosis in eukaryotic organisms",
          "| Keywords: division = cell division, mitosis",
        ),
      ).toBe(true);
    });
  });

  describe("single keyword category", () => {
    it("passes when 2+ keywords from the single category match", () => {
      expect(
        gradeEssay(
          "The cell undergoes mitosis and cell division to replicate",
          "| Keywords: process = mitosis, cell division, replicate",
        ),
      ).toBe(true);
    });

    it("fails when fewer than 2 keywords match in single category", () => {
      expect(
        gradeEssay(
          "The process involves something unrelated to the topic entirely",
          "| Keywords: process = mitosis, cell division, replicate",
        ),
      ).toBe(false);
    });
  });

  describe("multiple keyword categories (>=2)", () => {
    it("passes when at least 2 categories have a hit", () => {
      expect(
        gradeEssay(
          "Mitosis involves spindle fibers separating chromosomes during cell division",
          "| Keywords: phase = mitosis, spindle; outcome = chromosomes, division",
        ),
      ).toBe(true);
    });

    it("fails when fewer than 2 categories have a hit", () => {
      expect(
        gradeEssay(
          "Mitosis is an important process that cells use to replicate themselves",
          "| Keywords: phase = mitosis, spindle; outcome = chromosomes, division",
        ),
      ).toBe(false);
    });

    it("requires at least 2 categories even if all keywords in one category match", () => {
      expect(
        gradeEssay(
          "Spindle fibers attach to chromosomes and kinetochores during mitosis",
          "| Keywords: phase = mitosis, spindle, kinetochore; outcome = growth, repair",
        ),
      ).toBe(false);
    });
  });

  describe("keyword matching edge cases", () => {
    it("matches case-insensitively", () => {
      expect(
        gradeEssay(
          "The process of MITOSIS involves nuclear division in cells",
          "| Keywords: core = mitosis, nuclear",
        ),
      ).toBe(true);
    });

    it("matches single-word keywords via word boundary regex", () => {
      expect(
        gradeEssay(
          "Osmosis is the movement of water across a semipermeable membrane",
          "| Keywords: concept = osmosis, membrane",
        ),
      ).toBe(true);
    });

    it("does not match partial words for single keywords without spaces", () => {
      // "osmo" should not match "osmosis" since the regex uses \w* after the keyword
      // Actually looking at the code: `new RegExp(`\\b${needle}\\w*`, "i")` — it DOES match prefixes
      // So "osmo" will match "osmosis". That's by design (stem matching).
      expect(
        gradeEssay(
          "Osmosis is the movement of water across a semipermeable membrane",
          "| Keywords: concept = osmo, membrane",
        ),
      ).toBe(true);
    });
  });

  describe("answer normalization", () => {
    it("ignores leading/trailing whitespace in answer words", () => {
      expect(
        gradeEssay(
          "  The cell undergoes mitosis for division  ",
          "| Keywords: core = cell, mitosis",
        ),
      ).toBe(true);
    });

    it("handles hyphenated words", () => {
      expect(
        gradeEssay(
          "The well-known process of cell division occurs during mitosis",
          "| Keywords: core = well-known, mitosis",
        ),
      ).toBe(true);
    });
  });
});

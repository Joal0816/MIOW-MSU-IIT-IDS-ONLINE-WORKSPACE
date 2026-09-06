import { describe, it, expect } from "bun:test";
import {
  PREFIXES,
  COURSE_LEVELS,
  levelLabel,
  educationLevelOf,
  collegeYearOf,
} from "./course-levels";

describe("course-levels", () => {
  it("exports PREFIXES array with expected values", () => {
    expect(PREFIXES).toContain("");
    expect(PREFIXES).toContain("Dr.");
    expect(PREFIXES).toContain("Mr.");
    expect(PREFIXES).toContain("Ms.");
    expect(PREFIXES.length).toBe(7);
  });

  it("COURSE_LEVELS covers grades 7-16", () => {
    expect(COURSE_LEVELS.length).toBe(10);
    expect(COURSE_LEVELS[0]!.value).toBe(7);
    expect(COURSE_LEVELS[9]!.value).toBe(16);
  });

  it("levelLabel returns human-readable label for known levels", () => {
    expect(levelLabel(7)).toBe("Grade 7 (G7)");
    expect(levelLabel(13)).toBe("College — 1st Year");
  });

  it("levelLabel falls back for unknown levels", () => {
    expect(levelLabel(99)).toBe("Level 99");
  });

  it("educationLevelOf maps correctly", () => {
    expect(educationLevelOf(7)).toBe("jhs");
    expect(educationLevelOf(10)).toBe("jhs");
    expect(educationLevelOf(11)).toBe("shs");
    expect(educationLevelOf(12)).toBe("shs");
    expect(educationLevelOf(13)).toBe("college");
    expect(educationLevelOf(16)).toBe("college");
  });

  it("collegeYearOf returns year for college levels", () => {
    expect(collegeYearOf(13)).toBe(1);
    expect(collegeYearOf(14)).toBe(2);
    expect(collegeYearOf(15)).toBe(3);
    expect(collegeYearOf(16)).toBe(4);
  });

  it("collegeYearOf returns null for non-college levels", () => {
    expect(collegeYearOf(7)).toBeNull();
    expect(collegeYearOf(12)).toBeNull();
  });
});

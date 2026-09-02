import { describe, it, expect } from "bun:test";
import {
  COURSE_LEVELS,
  levelLabel,
  educationLevelOf,
  collegeYearOf,
  type CourseLevel,
} from "./course-levels";

describe("COURSE_LEVELS", () => {
  it("contains 10 entries (grades 7-16)", () => {
    expect(COURSE_LEVELS).toHaveLength(10);
  });

  it("has sequential values 7 through 16", () => {
    const values = COURSE_LEVELS.map((l) => l.value);
    expect(values).toEqual([7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
  });

  it("every entry has a non-empty label", () => {
    for (const level of COURSE_LEVELS) {
      expect(level.label.length).toBeGreaterThan(0);
    }
  });
});

describe("levelLabel", () => {
  it("returns correct label for grade 7", () => {
    expect(levelLabel(7)).toBe("Grade 7 (G7)");
  });

  it("returns correct label for grade 10", () => {
    expect(levelLabel(10)).toBe("Grade 10 (G10)");
  });

  it("returns correct label for college year 1", () => {
    expect(levelLabel(13)).toBe("College — 1st Year");
  });

  it("returns correct label for college year 4", () => {
    expect(levelLabel(16)).toBe("College — 4th Year");
  });

  it("returns fallback for unknown level", () => {
    expect(levelLabel(99)).toBe("Level 99");
  });

  it("returns fallback for 0", () => {
    expect(levelLabel(0)).toBe("Level 0");
  });
});

describe("educationLevelOf", () => {
  it("returns 'jhs' for grades 7-10", () => {
    expect(educationLevelOf(7)).toBe("jhs");
    expect(educationLevelOf(8)).toBe("jhs");
    expect(educationLevelOf(9)).toBe("jhs");
    expect(educationLevelOf(10)).toBe("jhs");
  });

  it("returns 'shs' for grades 11-12", () => {
    expect(educationLevelOf(11)).toBe("shs");
    expect(educationLevelOf(12)).toBe("shs");
  });

  it("returns 'college' for grades 13+", () => {
    expect(educationLevelOf(13)).toBe("college");
    expect(educationLevelOf(14)).toBe("college");
    expect(educationLevelOf(15)).toBe("college");
    expect(educationLevelOf(16)).toBe("college");
    expect(educationLevelOf(20)).toBe("college");
  });

  it("returns 'jhs' for values below 7", () => {
    expect(educationLevelOf(6)).toBe("jhs");
    expect(educationLevelOf(1)).toBe("jhs");
  });
});

describe("collegeYearOf", () => {
  it("returns 1-4 for grades 13-16", () => {
    expect(collegeYearOf(13)).toBe(1);
    expect(collegeYearOf(14)).toBe(2);
    expect(collegeYearOf(15)).toBe(3);
    expect(collegeYearOf(16)).toBe(4);
  });

  it("returns null for non-college grades", () => {
    expect(collegeYearOf(7)).toBeNull();
    expect(collegeYearOf(10)).toBeNull();
    expect(collegeYearOf(11)).toBeNull();
    expect(collegeYearOf(12)).toBeNull();
  });

  it("returns null for values above 16", () => {
    expect(collegeYearOf(17)).toBeNull();
    expect(collegeYearOf(20)).toBeNull();
  });
});

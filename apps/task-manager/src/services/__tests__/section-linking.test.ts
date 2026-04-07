import { describe, it, expect } from "vitest";
import {
  parseSourceSection,
  generateSectionAnchors,
  isLinkableSection,
  canNavigateToSpec,
} from "../section-linking";

describe("parseSourceSection", () => {
  describe("valid formats", () => {
    it("parses 'Section 5.3' format", () => {
      const result = parseSourceSection("Section 5.3");
      expect(result).not.toBeNull();
      expect(result!.sectionNumber).toBe("5.3");
      expect(result!.sectionTitle).toBeNull();
      expect(result!.displayText).toBe("Section 5.3");
    });

    it("parses 'Section 5.3: Feature Name' format", () => {
      const result = parseSourceSection("Section 5.3: Feature Name");
      expect(result).not.toBeNull();
      expect(result!.sectionNumber).toBe("5.3");
      expect(result!.sectionTitle).toBe("Feature Name");
      expect(result!.displayText).toBe("Section 5.3: Feature Name");
    });

    it("parses 'Section 5.3 - Feature Name' format", () => {
      const result = parseSourceSection("Section 5.3 - Feature Name");
      expect(result).not.toBeNull();
      expect(result!.sectionNumber).toBe("5.3");
      expect(result!.sectionTitle).toBe("Feature Name");
    });

    it("parses bare number '5.3' format", () => {
      const result = parseSourceSection("5.3");
      expect(result).not.toBeNull();
      expect(result!.sectionNumber).toBe("5.3");
      expect(result!.sectionTitle).toBeNull();
      expect(result!.displayText).toBe("Section 5.3");
    });

    it("parses '5.3: Feature Name' format", () => {
      const result = parseSourceSection("5.3: Feature Name");
      expect(result).not.toBeNull();
      expect(result!.sectionNumber).toBe("5.3");
      expect(result!.sectionTitle).toBe("Feature Name");
    });

    it("parses '5.3 Feature Name' format (space separator)", () => {
      const result = parseSourceSection("5.3 Feature Name");
      expect(result).not.toBeNull();
      expect(result!.sectionNumber).toBe("5.3");
      expect(result!.sectionTitle).toBe("Feature Name");
    });

    it("parses subsection format '5.3.1'", () => {
      const result = parseSourceSection("Section 5.3.1");
      expect(result).not.toBeNull();
      expect(result!.sectionNumber).toBe("5.3.1");
      expect(result!.sectionTitle).toBeNull();
    });

    it("parses single-number section '7'", () => {
      const result = parseSourceSection("Section 7");
      expect(result).not.toBeNull();
      expect(result!.sectionNumber).toBe("7");
      expect(result!.sectionTitle).toBeNull();
    });

    it("is case-insensitive for 'section' prefix", () => {
      const result = parseSourceSection("section 5.3");
      expect(result).not.toBeNull();
      expect(result!.sectionNumber).toBe("5.3");
    });

    it("handles whitespace around the input", () => {
      const result = parseSourceSection("  Section 5.3  ");
      expect(result).not.toBeNull();
      expect(result!.sectionNumber).toBe("5.3");
    });

    it("preserves the raw input string", () => {
      const input = "Section 5.7: Spec Lifecycle View";
      const result = parseSourceSection(input);
      expect(result).not.toBeNull();
      expect(result!.raw).toBe(input);
    });

    it("generates headingText for title-less sections", () => {
      const result = parseSourceSection("5.3");
      expect(result).not.toBeNull();
      expect(result!.headingText).toBe("5.3");
    });

    it("generates headingText combining number and title", () => {
      const result = parseSourceSection("5.3: Feature Name");
      expect(result).not.toBeNull();
      expect(result!.headingText).toBe("5.3 Feature Name");
    });
  });

  describe("invalid formats", () => {
    it("returns null for undefined", () => {
      expect(parseSourceSection(undefined)).toBeNull();
    });

    it("returns null for null", () => {
      expect(parseSourceSection(null)).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(parseSourceSection("")).toBeNull();
    });

    it("returns null for whitespace-only string", () => {
      expect(parseSourceSection("   ")).toBeNull();
    });

    it("returns null for non-numeric text", () => {
      expect(parseSourceSection("Introduction")).toBeNull();
    });

    it("returns null for text without numbers", () => {
      expect(parseSourceSection("Some random text")).toBeNull();
    });
  });
});

describe("generateSectionAnchors", () => {
  it("generates anchors for section with title", () => {
    const parsed = parseSourceSection("Section 5.3: Feature Name")!;
    const anchors = generateSectionAnchors(parsed);

    expect(anchors.length).toBeGreaterThan(0);
    // Should include an anchor derived from "5.3 Feature Name"
    expect(anchors).toContain("53-feature-name");
  });

  it("generates anchors for section without title", () => {
    const parsed = parseSourceSection("5.3")!;
    const anchors = generateSectionAnchors(parsed);

    expect(anchors.length).toBeGreaterThan(0);
    // Should include "53" as a candidate
    expect(anchors).toContain("53");
  });

  it("deduplicates anchor candidates", () => {
    const parsed = parseSourceSection("5.3")!;
    const anchors = generateSectionAnchors(parsed);

    const unique = new Set(anchors);
    expect(unique.size).toBe(anchors.length);
  });

  it("returns multiple candidates for fuzzy matching", () => {
    const parsed = parseSourceSection("Section 5.7: Spec Lifecycle View")!;
    const anchors = generateSectionAnchors(parsed);

    // Should have at least 3 candidates (heading, number-only, with-section-prefix)
    expect(anchors.length).toBeGreaterThanOrEqual(3);
  });
});

describe("isLinkableSection", () => {
  it("returns true for valid section format", () => {
    expect(isLinkableSection("Section 5.3")).toBe(true);
    expect(isLinkableSection("5.3")).toBe(true);
    expect(isLinkableSection("5.3: Feature")).toBe(true);
  });

  it("returns false for invalid formats", () => {
    expect(isLinkableSection(undefined)).toBe(false);
    expect(isLinkableSection(null)).toBe(false);
    expect(isLinkableSection("")).toBe(false);
    expect(isLinkableSection("Introduction")).toBe(false);
  });
});

describe("canNavigateToSpec", () => {
  it("returns true when both spec_path and valid source_section exist", () => {
    expect(canNavigateToSpec("specs/auth-SPEC.md", "Section 5.3")).toBe(true);
  });

  it("returns false when spec_path is missing", () => {
    expect(canNavigateToSpec(undefined, "Section 5.3")).toBe(false);
    expect(canNavigateToSpec(null, "Section 5.3")).toBe(false);
    expect(canNavigateToSpec("", "Section 5.3")).toBe(false);
  });

  it("returns false when source_section is invalid", () => {
    expect(canNavigateToSpec("specs/auth-SPEC.md", undefined)).toBe(false);
    expect(canNavigateToSpec("specs/auth-SPEC.md", "Introduction")).toBe(false);
  });

  it("returns false when both are missing", () => {
    expect(canNavigateToSpec(undefined, undefined)).toBe(false);
  });
});

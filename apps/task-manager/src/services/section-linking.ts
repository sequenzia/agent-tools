import { generateAnchorId } from "./spec-service";

/**
 * Parsed result from a source_section string.
 */
export interface ParsedSection {
  /** The raw input string. */
  raw: string;
  /** The section number (e.g., "5.3", "5.7.1"). */
  sectionNumber: string;
  /** The section title/name, if present (e.g., "Feature Name"). */
  sectionTitle: string | null;
  /** The display text for the link (e.g., "Section 5.3: Feature Name"). */
  displayText: string;
  /** The heading text to search for in the spec (e.g., "5.3 Feature Name"). */
  headingText: string | null;
}

/**
 * Patterns for parsing source_section values.
 *
 * Supported formats:
 * - "Section 5.3"
 * - "Section 5.3: Feature Name"
 * - "Section 5.3 - Feature Name"
 * - "5.3"
 * - "5.3: Feature Name"
 * - "5.3 Feature Name"
 * - "5.3 - Feature Name"
 * - "Section 5.3.1"  (subsections)
 * - "section 5.3" (case insensitive)
 */

// Match: optional "Section " prefix, then a dotted number, then optional separator + title
const SECTION_PATTERN =
  /^(?:section\s+)?(\d+(?:\.\d+)*)(?:\s*[:]\s*|\s*-\s*|\s+)?(.+)?$/i;

/**
 * Parse a source_section metadata string into structured data.
 *
 * @param sourceSection - The raw source_section value from task metadata.
 * @returns Parsed section info, or null if the format is invalid.
 */
export function parseSourceSection(
  sourceSection: string | undefined | null,
): ParsedSection | null {
  if (!sourceSection || typeof sourceSection !== "string") return null;

  const trimmed = sourceSection.trim();
  if (trimmed.length === 0) return null;

  const match = SECTION_PATTERN.exec(trimmed);
  if (!match) return null;

  const sectionNumber = match[1];
  const sectionTitle = match[2]?.trim() || null;

  const displayText = sectionTitle
    ? `Section ${sectionNumber}: ${sectionTitle}`
    : `Section ${sectionNumber}`;

  // Build the heading text that would appear in the spec markdown.
  // Spec headings typically look like "### 5.3 Feature Name" or "### 5.3: Feature Name"
  const headingText = sectionTitle
    ? `${sectionNumber} ${sectionTitle}`
    : sectionNumber;

  return {
    raw: sourceSection,
    sectionNumber,
    sectionTitle,
    displayText,
    headingText,
  };
}

/**
 * Generate candidate anchor IDs for a parsed section.
 * Returns multiple candidates in priority order for fuzzy matching:
 * 1. Full heading text anchor (e.g., "53-feature-name")
 * 2. Section number + title with different separators
 * 3. Section number only
 *
 * @param parsed - The parsed section info.
 * @returns Array of candidate anchor IDs to try, in priority order.
 */
export function generateSectionAnchors(parsed: ParsedSection): string[] {
  const candidates: string[] = [];

  // Candidate 1: heading text as-is (most specific)
  if (parsed.headingText) {
    candidates.push(generateAnchorId(parsed.headingText));
  }

  // Candidate 2: with "Feature:" prefix pattern
  if (parsed.sectionTitle) {
    candidates.push(
      generateAnchorId(`${parsed.sectionNumber} Feature: ${parsed.sectionTitle}`),
    );
  }

  // Candidate 3: section number only
  candidates.push(generateAnchorId(parsed.sectionNumber));

  // Candidate 4: with "Section" prefix
  if (parsed.headingText) {
    candidates.push(generateAnchorId(`Section ${parsed.headingText}`));
  }

  // Deduplicate while preserving order
  const seen = new Set<string>();
  return candidates.filter((c) => {
    if (seen.has(c)) return false;
    seen.add(c);
    return true;
  });
}

/**
 * Determine if a source_section value is in a valid, linkable format.
 *
 * @param sourceSection - The raw source_section value.
 * @returns True if the format is valid and should be rendered as a link.
 */
export function isLinkableSection(
  sourceSection: string | undefined | null,
): boolean {
  return parseSourceSection(sourceSection) !== null;
}

/**
 * Check whether a task has both a spec_path and a valid source_section,
 * making it eligible for spec-section navigation.
 *
 * @param specPath - The spec_path from task metadata.
 * @param sourceSection - The source_section from task metadata.
 * @returns True if navigation to the spec section is possible.
 */
export function canNavigateToSpec(
  specPath: string | undefined | null,
  sourceSection: string | undefined | null,
): boolean {
  if (!specPath || typeof specPath !== "string" || specPath.trim().length === 0) {
    return false;
  }
  return isLinkableSection(sourceSection);
}

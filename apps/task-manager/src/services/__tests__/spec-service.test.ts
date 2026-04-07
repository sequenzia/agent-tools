import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import {
  readSpec,
  checkSpecAnalysis,
  readSpecAnalysis,
  generateAnchorId,
} from "../spec-service";

const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("readSpec", () => {
  it("calls invoke with correct command and parameters", async () => {
    const specContent = {
      content: "# Spec",
      resolved_path: "/project/spec.md",
      size: 7,
    };
    mockInvoke.mockResolvedValueOnce(specContent);

    const result = await readSpec("/project", "internal/spec.md");

    expect(mockInvoke).toHaveBeenCalledWith("read_spec", {
      projectPath: "/project",
      specPath: "internal/spec.md",
    });
    expect(result).toEqual(specContent);
  });

  it("throws when the IPC call fails", async () => {
    mockInvoke.mockRejectedValueOnce("Spec file not found");

    await expect(readSpec("/project", "missing.md")).rejects.toBe(
      "Spec file not found",
    );
  });
});

describe("checkSpecAnalysis", () => {
  it("calls invoke with correct command and parameters", async () => {
    const analysisCheck = {
      exists: true,
      analysis_path: "/project/spec.analysis.md",
    };
    mockInvoke.mockResolvedValueOnce(analysisCheck);

    const result = await checkSpecAnalysis("/project", "spec.md");

    expect(mockInvoke).toHaveBeenCalledWith("check_spec_analysis", {
      projectPath: "/project",
      specPath: "spec.md",
    });
    expect(result).toEqual(analysisCheck);
  });

  it("returns exists: false when no analysis file", async () => {
    const analysisCheck = {
      exists: false,
      analysis_path: "/project/spec.analysis.md",
    };
    mockInvoke.mockResolvedValueOnce(analysisCheck);

    const result = await checkSpecAnalysis("/project", "spec.md");

    expect(result.exists).toBe(false);
  });
});

describe("readSpecAnalysis", () => {
  it("reads analysis file via read_spec command", async () => {
    const analysisContent = {
      content: "# Analysis",
      resolved_path: "/project/spec.analysis.md",
      size: 10,
    };
    mockInvoke.mockResolvedValueOnce(analysisContent);

    const result = await readSpecAnalysis(
      "/project",
      "/project/spec.analysis.md",
    );

    expect(mockInvoke).toHaveBeenCalledWith("read_spec", {
      projectPath: "/project",
      specPath: "/project/spec.analysis.md",
    });
    expect(result).toEqual(analysisContent);
  });

  it("returns null when analysis file is not found", async () => {
    mockInvoke.mockRejectedValueOnce("File not found");

    const result = await readSpecAnalysis(
      "/project",
      "/project/missing.analysis.md",
    );

    expect(result).toBeNull();
  });
});

describe("generateAnchorId", () => {
  it("converts heading text to lowercase kebab-case", () => {
    expect(generateAnchorId("Executive Summary")).toBe("executive-summary");
  });

  it("handles numbers in heading text", () => {
    expect(generateAnchorId("Section 5.7")).toBe("section-57");
  });

  it("strips special characters", () => {
    expect(generateAnchorId("What's New?")).toBe("whats-new");
  });

  it("collapses multiple hyphens", () => {
    expect(generateAnchorId("A -- B")).toBe("a-b");
  });

  it("trims leading and trailing hyphens", () => {
    expect(generateAnchorId("  Hello World  ")).toBe("hello-world");
  });

  it("handles empty string", () => {
    expect(generateAnchorId("")).toBe("");
  });

  it("handles heading with only special characters", () => {
    expect(generateAnchorId("---")).toBe("");
  });

  it("handles unicode and special characters", () => {
    expect(generateAnchorId("Feature: User Auth!")).toBe("feature-user-auth");
  });

  it("handles heading with parentheses and brackets", () => {
    expect(generateAnchorId("API (v2) [beta]")).toBe("api-v2-beta");
  });

  it("handles heading with backticks and code", () => {
    expect(generateAnchorId("Using `readSpec` Function")).toBe(
      "using-readspec-function",
    );
  });
});

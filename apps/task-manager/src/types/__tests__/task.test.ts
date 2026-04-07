import { describe, it, expect } from "vitest";
import {
  TaskSchema,
  TaskManifestSchema,
  TaskStatusSchema,
  PrioritySchema,
  ComplexitySchema,
  AcceptanceCriteriaSchema,
  TaskMetadataSchema,
  parseTask,
  safeParseTask,
  parseTaskManifest,
  safeParseTaskManifest,
} from "../task";

// --- Sample data ---

const validTask = {
  id: "126",
  title: "Create TypeScript task data model",
  description:
    "Define TypeScript types and Zod runtime validation schemas matching the SDD task JSON schema.",
  status: "pending",
  acceptance_criteria: {
    functional: [
      "All SDD task JSON fields are represented in TypeScript types",
      "Zod schemas validate real task JSON files without errors",
    ],
    edge_cases: ["Optional fields handled correctly"],
    error_handling: [
      "Zod parse errors produce descriptive messages identifying the invalid field",
    ],
    performance: [],
  },
  testing_requirements: [
    "Unit: Zod schemas validate sample task JSON correctly",
    "Unit: Zod schemas reject malformed task JSON with clear errors",
  ],
  blocked_by: ["125", "124"],
  blocks: ["130"],
  metadata: {
    priority: "high",
    complexity: "S",
    task_group: "task-manager",
    spec_path: "internal/specs/task-manager-SPEC.md",
    feature_name: "Foundation",
    source_section: "Section 9.1",
    spec_phase: 1,
    spec_phase_name: "Foundation",
    produces_for: ["130", "131"],
    task_uid: "task-manager:foundation:model:001",
  },
  created_at: "2026-04-06T12:00:00.000Z",
  updated_at: "2026-04-06T14:30:00.000Z",
};

const minimalTask = {
  id: 42,
  title: "Fix button color",
  description: "The button should be blue",
  status: "in_progress",
};

const validManifest = {
  task_group: "task-manager",
  spec_path: "internal/specs/task-manager-SPEC.md",
  total: 25,
  backlog: 5,
  pending: 10,
  in_progress: 3,
  completed: 7,
  created_at: "2026-04-06T12:00:00.000Z",
  updated_at: "2026-04-06T14:30:00.000Z",
};

// --- TaskSchema tests ---

describe("TaskSchema", () => {
  it("validates a fully populated task", () => {
    const result = TaskSchema.safeParse(validTask);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe("126");
      expect(result.data.title).toBe("Create TypeScript task data model");
      expect(result.data.status).toBe("pending");
      expect(result.data.blocked_by).toEqual(["125", "124"]);
      expect(result.data.metadata?.priority).toBe("high");
      expect(result.data.metadata?.complexity).toBe("S");
      expect(result.data.metadata?.spec_phase).toBe(1);
      expect(result.data.metadata?.produces_for).toEqual(["130", "131"]);
      expect(result.data.acceptance_criteria?.functional).toHaveLength(2);
    }
  });

  it("validates a minimal task (only required fields)", () => {
    const result = TaskSchema.safeParse(minimalTask);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(42);
      expect(result.data.title).toBe("Fix button color");
      expect(result.data.status).toBe("in_progress");
      expect(result.data.acceptance_criteria).toBeUndefined();
      expect(result.data.testing_requirements).toBeUndefined();
      expect(result.data.blocked_by).toBeUndefined();
      expect(result.data.metadata).toBeUndefined();
    }
  });

  it("accepts numeric task IDs", () => {
    const result = TaskSchema.safeParse({ ...minimalTask, id: 7 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(7);
    }
  });

  it("accepts string task IDs", () => {
    const result = TaskSchema.safeParse({ ...minimalTask, id: "abc-123" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe("abc-123");
    }
  });

  it("tolerates unknown/extra fields (forward compatibility)", () => {
    const taskWithExtras = {
      ...validTask,
      future_field: "some new data",
      another_unknown: 42,
    };
    const result = TaskSchema.safeParse(taskWithExtras);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.future_field).toBe("some new data");
      expect(result.data.another_unknown).toBe(42);
    }
  });

  it("tolerates unknown fields in metadata (forward compatibility)", () => {
    const task = {
      ...minimalTask,
      metadata: {
        priority: "high",
        some_new_meta: "value",
      },
    };
    const result = TaskSchema.safeParse(task);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.metadata?.some_new_meta).toBe("value");
    }
  });

  it("tolerates unknown fields in acceptance_criteria (forward compatibility)", () => {
    const task = {
      ...minimalTask,
      acceptance_criteria: {
        functional: ["criterion 1"],
        security: ["no SQL injection"],
      },
    };
    const result = TaskSchema.safeParse(task);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.acceptance_criteria?.security).toEqual([
        "no SQL injection",
      ]);
    }
  });

  it("rejects task missing required field: title", () => {
    const result = TaskSchema.safeParse({
      id: "1",
      description: "desc",
      status: "pending",
    });
    expect(result.success).toBe(false);
  });

  it("rejects task missing required field: id", () => {
    const result = TaskSchema.safeParse({
      title: "Test",
      description: "desc",
      status: "pending",
    });
    expect(result.success).toBe(false);
  });

  it("rejects task missing required field: description", () => {
    const result = TaskSchema.safeParse({
      id: "1",
      title: "Test",
      status: "pending",
    });
    expect(result.success).toBe(false);
  });

  it("rejects task missing required field: status", () => {
    const result = TaskSchema.safeParse({
      id: "1",
      title: "Test",
      description: "desc",
    });
    expect(result.success).toBe(false);
  });

  it("rejects task with invalid status value", () => {
    const result = TaskSchema.safeParse({
      ...minimalTask,
      status: "done",
    });
    expect(result.success).toBe(false);
  });

  it("rejects task with invalid priority in metadata", () => {
    const result = TaskSchema.safeParse({
      ...minimalTask,
      metadata: { priority: "urgent" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects task with invalid complexity in metadata", () => {
    const result = TaskSchema.safeParse({
      ...minimalTask,
      metadata: { complexity: "XXL" },
    });
    expect(result.success).toBe(false);
  });
});

// --- Parse error messages ---

describe("Zod parse error messages", () => {
  it("identifies the invalid field in error messages", () => {
    const result = TaskSchema.safeParse({
      id: "1",
      title: "Test",
      description: "desc",
      status: "invalid_status",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = result.error.issues;
      expect(issues.length).toBeGreaterThan(0);
      const statusIssue = issues.find(
        (i) =>
          i.path?.includes("status") || JSON.stringify(i).includes("status"),
      );
      expect(statusIssue).toBeDefined();
    }
  });

  it("identifies nested field paths in error messages", () => {
    const result = TaskSchema.safeParse({
      ...minimalTask,
      metadata: { priority: "not-a-priority" },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = result.error.issues;
      expect(issues.length).toBeGreaterThan(0);
      const priorityIssue = issues.find(
        (i) =>
          (i.path && i.path.includes("priority")) ||
          (i.path && i.path.includes("metadata")),
      );
      expect(priorityIssue).toBeDefined();
    }
  });

  it("parseTask throws ZodError on invalid input", () => {
    expect(() =>
      parseTask({ id: "1", title: "T", description: "d", status: "bad" }),
    ).toThrow();
  });

  it("safeParseTask returns error result on invalid input", () => {
    const result = safeParseTask({
      id: "1",
      title: "T",
      description: "d",
      status: "bad",
    });
    expect(result.success).toBe(false);
  });
});

// --- TaskStatusSchema ---

describe("TaskStatusSchema", () => {
  it.each(["backlog", "pending", "in_progress", "completed"])(
    "accepts valid status: %s",
    (status) => {
      expect(TaskStatusSchema.safeParse(status).success).toBe(true);
    },
  );

  it.each(["done", "failed", "blocked", "running", ""])(
    "rejects invalid status: '%s'",
    (status) => {
      expect(TaskStatusSchema.safeParse(status).success).toBe(false);
    },
  );
});

// --- PrioritySchema ---

describe("PrioritySchema", () => {
  it.each(["critical", "high", "medium", "low"])(
    "accepts valid priority: %s",
    (p) => {
      expect(PrioritySchema.safeParse(p).success).toBe(true);
    },
  );

  it.each(["urgent", "none", "P0", ""])(
    "rejects invalid priority: '%s'",
    (p) => {
      expect(PrioritySchema.safeParse(p).success).toBe(false);
    },
  );
});

// --- ComplexitySchema ---

describe("ComplexitySchema", () => {
  it.each(["XS", "S", "M", "L", "XL"])("accepts valid complexity: %s", (c) => {
    expect(ComplexitySchema.safeParse(c).success).toBe(true);
  });

  it.each(["xs", "small", "XXL", ""])(
    "rejects invalid complexity: '%s'",
    (c) => {
      expect(ComplexitySchema.safeParse(c).success).toBe(false);
    },
  );
});

// --- AcceptanceCriteriaSchema ---

describe("AcceptanceCriteriaSchema", () => {
  it("accepts empty object (all fields optional)", () => {
    expect(AcceptanceCriteriaSchema.safeParse({}).success).toBe(true);
  });

  it("accepts partial criteria", () => {
    const result = AcceptanceCriteriaSchema.safeParse({
      functional: ["must work"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts full criteria", () => {
    const result = AcceptanceCriteriaSchema.safeParse({
      functional: ["a"],
      edge_cases: ["b"],
      error_handling: ["c"],
      performance: ["d"],
    });
    expect(result.success).toBe(true);
  });
});

// --- TaskMetadataSchema ---

describe("TaskMetadataSchema", () => {
  it("accepts empty object (all fields optional)", () => {
    expect(TaskMetadataSchema.safeParse({}).success).toBe(true);
  });

  it("accepts full metadata with optional fields", () => {
    const result = TaskMetadataSchema.safeParse({
      priority: "critical",
      complexity: "XL",
      task_group: "auth",
      spec_path: "specs/auth.md",
      feature_name: "Auth",
      source_section: "7.3",
      spec_phase: 2,
      spec_phase_name: "Core",
      produces_for: ["10", "11"],
      task_uid: "auth:login:model:001",
    });
    expect(result.success).toBe(true);
  });

  it("handles optional spec_phase (omitted)", () => {
    const result = TaskMetadataSchema.safeParse({
      priority: "medium",
      task_group: "no-phases",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.spec_phase).toBeUndefined();
    }
  });

  it("handles optional produces_for (omitted)", () => {
    const result = TaskMetadataSchema.safeParse({
      priority: "low",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.produces_for).toBeUndefined();
    }
  });
});

// --- TaskManifestSchema ---

describe("TaskManifestSchema", () => {
  it("validates a full manifest", () => {
    const result = TaskManifestSchema.safeParse(validManifest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.task_group).toBe("task-manager");
      expect(result.data.total).toBe(25);
      expect(result.data.pending).toBe(10);
    }
  });

  it("validates a minimal manifest (required fields only)", () => {
    const result = TaskManifestSchema.safeParse({
      task_group: "auth",
      total: 10,
      backlog: 2,
      pending: 3,
      in_progress: 2,
      completed: 3,
    });
    expect(result.success).toBe(true);
  });

  it("tolerates unknown fields in manifest (forward compatibility)", () => {
    const result = TaskManifestSchema.safeParse({
      ...validManifest,
      some_future_stat: 99,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.some_future_stat).toBe(99);
    }
  });

  it("rejects manifest missing required field: task_group", () => {
    const noGroup = { ...validManifest };
    delete (noGroup as Record<string, unknown>).task_group;
    expect(TaskManifestSchema.safeParse(noGroup).success).toBe(false);
  });

  it("rejects manifest missing required field: total", () => {
    const noTotal = { ...validManifest };
    delete (noTotal as Record<string, unknown>).total;
    expect(TaskManifestSchema.safeParse(noTotal).success).toBe(false);
  });

  it("rejects manifest with negative count", () => {
    const result = TaskManifestSchema.safeParse({
      ...validManifest,
      pending: -1,
    });
    expect(result.success).toBe(false);
  });

  it("parseTaskManifest throws on invalid input", () => {
    expect(() => parseTaskManifest({ task_group: "x" })).toThrow();
  });

  it("safeParseTaskManifest returns error on invalid input", () => {
    const result = safeParseTaskManifest({ task_group: "x" });
    expect(result.success).toBe(false);
  });
});

// --- Imports from index ---

describe("module exports", () => {
  it("exports all types and schemas from index", async () => {
    const mod = await import("../index");
    expect(mod.TaskSchema).toBeDefined();
    expect(mod.TaskManifestSchema).toBeDefined();
    expect(mod.TaskStatusSchema).toBeDefined();
    expect(mod.PrioritySchema).toBeDefined();
    expect(mod.ComplexitySchema).toBeDefined();
    expect(mod.AcceptanceCriteriaSchema).toBeDefined();
    expect(mod.TaskMetadataSchema).toBeDefined();
    expect(mod.parseTask).toBeInstanceOf(Function);
    expect(mod.safeParseTask).toBeInstanceOf(Function);
    expect(mod.parseTaskManifest).toBeInstanceOf(Function);
    expect(mod.safeParseTaskManifest).toBeInstanceOf(Function);
  });
});

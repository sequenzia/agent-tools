import { z } from "zod";

// --- Enums ---

export const PrioritySchema = z.enum(["critical", "high", "medium", "low"]);
export type Priority = z.infer<typeof PrioritySchema>;

export const ComplexitySchema = z.enum(["XS", "S", "M", "L", "XL"]);
export type Complexity = z.infer<typeof ComplexitySchema>;

export const TaskStatusSchema = z.enum([
  "backlog",
  "pending",
  "in_progress",
  "completed",
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

// --- Acceptance Criteria ---

export const AcceptanceCriteriaSchema = z
  .object({
    functional: z.array(z.string()).optional(),
    edge_cases: z.array(z.string()).optional(),
    error_handling: z.array(z.string()).optional(),
    performance: z.array(z.string()).optional(),
  })
  .passthrough();
export type AcceptanceCriteria = z.infer<typeof AcceptanceCriteriaSchema>;

// --- Task Metadata ---

export const TaskMetadataSchema = z
  .object({
    priority: PrioritySchema.optional(),
    complexity: ComplexitySchema.optional(),
    task_group: z.string().optional(),
    spec_path: z.string().optional(),
    feature_name: z.string().optional(),
    source_section: z.string().optional(),
    spec_phase: z.number().int().optional(),
    spec_phase_name: z.string().optional(),
    produces_for: z.array(z.string()).optional(),
    task_uid: z.string().optional(),
  })
  .passthrough();
export type TaskMetadata = z.infer<typeof TaskMetadataSchema>;

// --- Task ---

export const TaskSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    title: z.string(),
    description: z.string(),
    status: TaskStatusSchema,
    acceptance_criteria: AcceptanceCriteriaSchema.optional(),
    testing_requirements: z.array(z.string()).optional(),
    blocked_by: z.array(z.union([z.string(), z.number()])).optional(),
    blocks: z.array(z.union([z.string(), z.number()])).optional(),
    metadata: TaskMetadataSchema.optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();
export type Task = z.infer<typeof TaskSchema>;

// --- Task Manifest ---

export const TaskManifestSchema = z
  .object({
    task_group: z.string(),
    spec_path: z.string().optional(),
    total: z.number().int().nonnegative(),
    backlog: z.number().int().nonnegative(),
    pending: z.number().int().nonnegative(),
    in_progress: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();
export type TaskManifest = z.infer<typeof TaskManifestSchema>;

// --- Parse helpers ---

/**
 * Parse a raw JSON object as a Task, returning the validated result.
 * Throws a ZodError with descriptive messages on invalid input.
 */
export function parseTask(data: unknown): Task {
  return TaskSchema.parse(data);
}

/**
 * Safely parse a raw JSON object as a Task, returning a discriminated result.
 */
export function safeParseTask(data: unknown) {
  return TaskSchema.safeParse(data);
}

/**
 * Parse a raw JSON object as a TaskManifest, returning the validated result.
 * Throws a ZodError with descriptive messages on invalid input.
 */
export function parseTaskManifest(data: unknown): TaskManifest {
  return TaskManifestSchema.parse(data);
}

/**
 * Safely parse a raw JSON object as a TaskManifest, returning a discriminated result.
 */
export function safeParseTaskManifest(data: unknown) {
  return TaskManifestSchema.safeParse(data);
}

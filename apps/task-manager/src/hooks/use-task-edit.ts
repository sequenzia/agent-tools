import { useState, useCallback, useRef } from "react";
import {
  updateTaskFields,
  ConflictError,
  type TaskWithPath,
  type TasksByStatus,
} from "../services/task-service";
import {
  TaskSchema,
  PrioritySchema,
  ComplexitySchema,
  type Priority,
  type Complexity,
  type AcceptanceCriteria,
} from "../types";

// --- Types ---

export type EditableField =
  | "priority"
  | "complexity"
  | "blocked_by"
  | "acceptance_criteria";

export interface FieldEditState {
  /** Which field is currently being edited, or null if viewing. */
  activeField: EditableField | null;
  /** Draft values for the field currently being edited. */
  draft: FieldDraft;
  /** Whether a save operation is in progress. */
  isSaving: boolean;
  /** Error message from the most recent save attempt. */
  saveError: string | null;
  /** Warning message (e.g., in_progress task, non-existent blocked_by). */
  warning: string | null;
}

export interface FieldDraft {
  priority: Priority | undefined;
  complexity: Complexity | undefined;
  blocked_by: (string | number)[];
  acceptance_criteria: AcceptanceCriteria;
}

export interface UseTaskEditResult {
  state: FieldEditState;
  /** Enter edit mode for a specific field. */
  startEditing: (field: EditableField) => void;
  /** Cancel the current edit, discarding draft changes. */
  cancelEditing: () => void;
  /** Update a draft value for the current field. */
  updateDraft: <K extends keyof FieldDraft>(
    key: K,
    value: FieldDraft[K],
  ) => void;
  /** Save the current draft to disk. Returns the updated TaskWithPath or null on failure. */
  saveField: () => Promise<TaskWithPath | null>;
}

// --- Validation helpers ---

function validatePriority(value: string | undefined): string | null {
  if (value === undefined || value === "") return null;
  const result = PrioritySchema.safeParse(value);
  if (!result.success) {
    return `Invalid priority: "${value}". Must be one of: critical, high, medium, low`;
  }
  return null;
}

function validateComplexity(value: string | undefined): string | null {
  if (value === undefined || value === "") return null;
  const result = ComplexitySchema.safeParse(value);
  if (!result.success) {
    return `Invalid complexity: "${value}". Must be one of: XS, S, M, L, XL`;
  }
  return null;
}

function validateBlockedBy(
  ids: (string | number)[],
  allTasks: TasksByStatus,
  currentTaskId: string | number,
): { error: string | null; warnings: string[] } {
  const warnings: string[] = [];

  // Collect all known task IDs
  const knownIds = new Set<string>();
  for (const status of ["backlog", "pending", "in_progress", "completed"] as const) {
    for (const twp of allTasks[status]) {
      knownIds.add(String(twp.task.id));
    }
  }

  // Check for self-reference
  const currentIdStr = String(currentTaskId);
  if (ids.some((id) => String(id) === currentIdStr)) {
    return { error: "A task cannot block itself", warnings };
  }

  // Check for non-existent IDs
  for (const id of ids) {
    if (!knownIds.has(String(id))) {
      warnings.push(`Task #${id} does not exist`);
    }
  }

  return { error: null, warnings };
}

function validateAcceptanceCriteria(ac: AcceptanceCriteria): string | null {
  for (const key of ["functional", "edge_cases", "error_handling", "performance"] as const) {
    const items = ac[key];
    if (items !== undefined && !Array.isArray(items)) {
      return `${key} must be an array of strings`;
    }
    if (Array.isArray(items) && items.some((item) => typeof item !== "string")) {
      return `All items in ${key} must be strings`;
    }
  }
  return null;
}

// --- Build the fields object for IPC ---

function buildFieldsForSave(
  field: EditableField,
  draft: FieldDraft,
): Record<string, unknown> {
  switch (field) {
    case "priority": {
      const metadata: Record<string, unknown> = {};
      if (draft.priority) {
        metadata.priority = draft.priority;
      }
      return { metadata };
    }
    case "complexity": {
      const metadata: Record<string, unknown> = {};
      if (draft.complexity) {
        metadata.complexity = draft.complexity;
      }
      return { metadata };
    }
    case "blocked_by":
      return { blocked_by: draft.blocked_by };
    case "acceptance_criteria":
      return { acceptance_criteria: draft.acceptance_criteria };
  }
}

function getInitialDraft(task: TaskWithPath): FieldDraft {
  const t = task.task;
  return {
    priority: t.metadata?.priority as Priority | undefined,
    complexity: t.metadata?.complexity as Complexity | undefined,
    blocked_by: t.blocked_by ? [...t.blocked_by] : [],
    acceptance_criteria: t.acceptance_criteria
      ? {
          functional: [...(t.acceptance_criteria.functional ?? [])],
          edge_cases: [...(t.acceptance_criteria.edge_cases ?? [])],
          error_handling: [...(t.acceptance_criteria.error_handling ?? [])],
          performance: [...(t.acceptance_criteria.performance ?? [])],
        }
      : { functional: [], edge_cases: [], error_handling: [], performance: [] },
  };
}

// --- Hook ---

export function useTaskEdit(
  task: TaskWithPath | null,
  allTasks: TasksByStatus,
  onSaved?: (updated: TaskWithPath) => void,
): UseTaskEditResult {
  const [state, setState] = useState<FieldEditState>({
    activeField: null,
    draft: {
      priority: undefined,
      complexity: undefined,
      blocked_by: [],
      acceptance_criteria: {
        functional: [],
        edge_cases: [],
        error_handling: [],
        performance: [],
      },
    },
    isSaving: false,
    saveError: null,
    warning: null,
  });

  // Track the original task values to detect changes
  const originalDraftRef = useRef<FieldDraft | null>(null);

  const startEditing = useCallback(
    (field: EditableField) => {
      if (!task) return;

      const draft = getInitialDraft(task);
      originalDraftRef.current = draft;

      let warning: string | null = null;
      if (task.task.status === "in_progress") {
        warning =
          "This task is currently in progress. Edits may be overwritten by the executing agent.";
      }

      setState({
        activeField: field,
        draft,
        isSaving: false,
        saveError: null,
        warning,
      });
    },
    [task],
  );

  const cancelEditing = useCallback(() => {
    originalDraftRef.current = null;
    setState((prev) => ({
      ...prev,
      activeField: null,
      isSaving: false,
      saveError: null,
      warning: null,
    }));
  }, []);

  const updateDraft = useCallback(
    <K extends keyof FieldDraft>(key: K, value: FieldDraft[K]) => {
      setState((prev) => ({
        ...prev,
        draft: { ...prev.draft, [key]: value },
        saveError: null,
      }));
    },
    [],
  );

  const saveField = useCallback(async (): Promise<TaskWithPath | null> => {
    if (!task || !state.activeField) return null;

    const field = state.activeField;
    const draft = state.draft;

    // --- Validate before saving ---
    let validationError: string | null = null;
    let validationWarnings: string[] = [];

    switch (field) {
      case "priority":
        validationError = validatePriority(draft.priority);
        break;
      case "complexity":
        validationError = validateComplexity(draft.complexity);
        break;
      case "blocked_by": {
        const result = validateBlockedBy(
          draft.blocked_by,
          allTasks,
          task.task.id,
        );
        validationError = result.error;
        validationWarnings = result.warnings;
        break;
      }
      case "acceptance_criteria":
        validationError = validateAcceptanceCriteria(draft.acceptance_criteria);
        break;
    }

    if (validationError) {
      setState((prev) => ({
        ...prev,
        saveError: validationError,
      }));
      return null;
    }

    // Show warnings but don't block save
    if (validationWarnings.length > 0) {
      setState((prev) => ({
        ...prev,
        warning: validationWarnings.join("; "),
      }));
    }

    // --- Build the fields to save ---
    const fields = buildFieldsForSave(field, draft);

    // --- Pre-save schema validation ---
    // Merge draft fields into the existing task and validate the whole thing
    const mergedTask = { ...task.task };
    if (field === "priority" || field === "complexity") {
      mergedTask.metadata = {
        ...mergedTask.metadata,
        ...(fields.metadata as Record<string, unknown>),
      };
    } else if (field === "blocked_by") {
      mergedTask.blocked_by = draft.blocked_by;
    } else if (field === "acceptance_criteria") {
      mergedTask.acceptance_criteria = draft.acceptance_criteria;
    }

    const schemaResult = TaskSchema.safeParse(mergedTask);
    if (!schemaResult.success) {
      setState((prev) => ({
        ...prev,
        saveError: `Schema validation failed: ${schemaResult.error.message}`,
      }));
      return null;
    }

    // --- Save to disk ---
    setState((prev) => ({ ...prev, isSaving: true, saveError: null }));

    try {
      const writeResult = await updateTaskFields(
        task.filePath,
        fields,
        task.mtimeMs,
      );

      // Parse the returned task
      const parsedResult = TaskSchema.safeParse(writeResult.task);
      if (!parsedResult.success) {
        setState((prev) => ({
          ...prev,
          isSaving: false,
          saveError: "Server returned invalid task data",
        }));
        return null;
      }

      const updatedTwp: TaskWithPath = {
        task: parsedResult.data,
        filePath: writeResult.filePath,
        mtimeMs: writeResult.mtimeMs,
      };

      // Reset edit state
      originalDraftRef.current = null;
      setState({
        activeField: null,
        draft: getInitialDraft(updatedTwp),
        isSaving: false,
        saveError: null,
        warning: null,
      });

      onSaved?.(updatedTwp);
      return updatedTwp;
    } catch (err) {
      let errorMessage: string;
      if (err instanceof ConflictError) {
        errorMessage =
          "Conflict: this task was modified externally. Please close and reopen to get the latest version.";
      } else if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === "string") {
        errorMessage = err;
      } else {
        errorMessage = "Failed to save changes";
      }

      setState((prev) => ({
        ...prev,
        isSaving: false,
        saveError: errorMessage,
      }));
      return null;
    }
  }, [task, state.activeField, state.draft, allTasks, onSaved]);

  return {
    state,
    startEditing,
    cancelEditing,
    updateDraft,
    saveField,
  };
}

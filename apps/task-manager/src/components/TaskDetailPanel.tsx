import { useEffect, useCallback, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import type { TaskWithPath, TasksByStatus } from "../services/task-service";
import type { Priority, Complexity, AcceptanceCriteria } from "../types";
import { PRIORITY_COLORS, COMPLEXITY_COLORS } from "./TaskCard";
import { DependencyGraph } from "./DependencyGraph";
import { useTaskEdit, type EditableField } from "../hooks/use-task-edit";
import {
  FieldEditorWrapper,
  PriorityEditor,
  ComplexityEditor,
  BlockedByEditor,
  AcceptanceCriteriaEditor,
} from "./InlineFieldEditor";
import {
  parseSourceSection,
  canNavigateToSpec,
} from "../services/section-linking";
import { useFocusTrap } from "../hooks/use-focus-trap";
import { STATUS_ICONS } from "./StatusIcon";

// --- Types ---

interface TaskDetailPanelProps {
  /** The task to display. Null means the panel is closed. */
  task: TaskWithPath | null;
  /** All tasks grouped by status (for resolving blocked_by titles). */
  allTasks: TasksByStatus;
  /** Called when the panel should close. */
  onClose: () => void;
  /** Called when a dependency graph node is clicked. Navigates to that task. */
  onTaskNavigate?: (task: TaskWithPath | null, taskId: string) => void;
  /** Called when a task field is saved. Receives the updated task for store refresh. */
  onTaskUpdated?: (updated: TaskWithPath) => void;
  /** Called when the user clicks a source_section link to view the spec at that section. */
  onViewSpec?: (specPath: string, scrollToSection?: string) => void;
}

// --- Markdown components (simplified from SpecViewer) ---

function CodeBlock({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <pre className="my-2 overflow-x-auto rounded bg-gray-100 p-2 dark:bg-gray-800">
      <code className={className}>{children}</code>
    </pre>
  );
}

const markdownComponents: Components = {
  pre: ({ children }) => <>{children}</>,
  code: CodeBlock as Components["code"],
  ul: ({ children }) => (
    <ul className="my-1 ml-5 list-disc space-y-0.5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-1 ml-5 list-decimal space-y-0.5">{children}</ol>
  ),
  li: ({ children }) => <li className="text-sm">{children}</li>,
  p: ({ children }) => (
    <p className="my-1.5 text-sm leading-relaxed">{children}</p>
  ),
  h1: ({ children }) => (
    <h1 className="mb-2 mt-3 text-lg font-bold">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-3 text-base font-bold">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1 mt-2 text-sm font-bold">{children}</h3>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-4 border-gray-300 pl-3 italic text-gray-600 dark:border-gray-600 dark:text-gray-400">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
    >
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="min-w-full border-collapse border border-gray-300 text-sm dark:border-gray-600">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-gray-100 dark:bg-gray-800">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="border border-gray-300 px-3 py-1 text-left text-xs font-semibold dark:border-gray-600">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-gray-300 px-3 py-1 text-xs dark:border-gray-600">
      {children}
    </td>
  ),
};

// Badge color maps imported from TaskCard

const STATUS_COLORS: Record<string, string> = {
  backlog: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  pending:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  in_progress:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  completed:
    "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
};

// --- Section component ---

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-gray-200 py-4 last:border-b-0 dark:border-gray-700">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {title}
      </h3>
      {children}
    </div>
  );
}

// --- Edit button for section headers ---

function EditButton({
  field,
  activeField,
  onClick,
}: {
  field: EditableField;
  activeField: EditableField | null;
  onClick: (field: EditableField) => void;
}) {
  if (activeField !== null) return null;
  return (
    <button
      onClick={() => onClick(field)}
      className="rounded px-1.5 py-0.5 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
      data-testid={`edit-${field}-button`}
      aria-label={`Edit ${field.replace("_", " ")}`}
    >
      Edit
    </button>
  );
}

function SectionWithEdit({
  title,
  field,
  activeField,
  onEdit,
  children,
}: {
  title: string;
  field: EditableField;
  activeField: EditableField | null;
  onEdit: (field: EditableField) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-gray-200 py-4 last:border-b-0 dark:border-gray-700">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {title}
        </h3>
        <EditButton field={field} activeField={activeField} onClick={onEdit} />
      </div>
      {children}
    </div>
  );
}

// --- Acceptance Criteria Section ---

const AC_CATEGORY_LABELS: Record<string, string> = {
  functional: "Functional",
  edge_cases: "Edge Cases",
  error_handling: "Error Handling",
  performance: "Performance",
};

const AC_CATEGORY_ORDER = [
  "functional",
  "edge_cases",
  "error_handling",
  "performance",
];

function AcceptanceCriteriaSection({
  criteria,
}: {
  criteria: AcceptanceCriteria;
}) {
  const hasAnyCriteria = AC_CATEGORY_ORDER.some((cat) => {
    const items = criteria[cat as keyof AcceptanceCriteria];
    return Array.isArray(items) && items.length > 0;
  });

  if (!hasAnyCriteria) {
    return (
      <p className="text-sm italic text-gray-400 dark:text-gray-500">
        No acceptance criteria defined
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {AC_CATEGORY_ORDER.map((cat) => {
        const items = criteria[cat as keyof AcceptanceCriteria];
        if (!Array.isArray(items) || items.length === 0) return null;
        return (
          <div key={cat}>
            <h4 className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-400">
              {AC_CATEGORY_LABELS[cat] ?? cat}
            </h4>
            <ul className="space-y-1">
              {items.map((item, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <span className="mt-0.5 h-4 w-4 shrink-0 rounded border border-gray-300 dark:border-gray-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

// --- Dependencies Section ---

function resolveDependencyTitle(
  depId: string | number,
  allTasks: TasksByStatus,
): { id: string; title: string | null } {
  const idStr = String(depId);
  const statuses = ["backlog", "pending", "in_progress", "completed"] as const;
  for (const status of statuses) {
    for (const twp of allTasks[status]) {
      if (String(twp.task.id) === idStr) {
        return { id: idStr, title: twp.task.title };
      }
    }
  }
  return { id: idStr, title: null };
}

function DependenciesSection({
  blockedBy,
  allTasks,
}: {
  blockedBy: (string | number)[];
  allTasks: TasksByStatus;
}) {
  if (blockedBy.length === 0) {
    return (
      <p
        className="text-sm italic text-gray-400 dark:text-gray-500"
        data-testid="no-dependencies"
      >
        No dependencies
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {blockedBy.map((depId) => {
        const resolved = resolveDependencyTitle(depId, allTasks);
        return (
          <li
            key={resolved.id}
            className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
          >
            <span className="shrink-0 text-xs text-gray-400">
              #{resolved.id}
            </span>
            <span>{resolved.title ?? `Task ${resolved.id}`}</span>
          </li>
        );
      })}
    </ul>
  );
}

// --- Main Panel Component ---

export function TaskDetailPanel({
  task,
  allTasks,
  onClose,
  onTaskNavigate,
  onTaskUpdated,
  onViewSpec,
}: TaskDetailPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const isOpen = task !== null;

  // Focus trap: traps Tab/Shift+Tab within the panel when open
  useFocusTrap(panelRef, isOpen);

  const {
    state: editState,
    startEditing,
    cancelEditing,
    updateDraft,
    saveField,
  } = useTaskEdit(task, allTasks, onTaskUpdated);

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Close on click outside panel
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  if (!isOpen || !task) {
    return null;
  }

  const { task: t } = task;
  const priority = t.metadata?.priority as Priority | undefined;
  const complexity = t.metadata?.complexity as Complexity | undefined;
  const taskGroup = t.metadata?.task_group;
  const specPath = t.metadata?.spec_path;
  const sourceSection = t.metadata?.source_section;
  const featureName = t.metadata?.feature_name;
  const specPhase = t.metadata?.spec_phase;
  const blockedBy = t.blocked_by ?? [];
  const acceptanceCriteria = t.acceptance_criteria;
  const testingRequirements = t.testing_requirements;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6"
      data-testid="task-detail-overlay"
      onClick={handleOverlayClick}
    >
      {/* Centered modal */}
      <div
        ref={panelRef}
        className="flex w-full max-w-4xl flex-col rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
        style={{ maxHeight: "90vh" }}
        data-testid="task-detail-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`Task details: ${t.title}`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-200 p-4 dark:border-gray-700">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-xs text-gray-400 dark:text-gray-500">
                #{String(t.id)}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[t.status] ?? STATUS_COLORS.backlog}`}
              >
                {(() => {
                  const Icon = STATUS_ICONS[t.status as keyof typeof STATUS_ICONS];
                  return Icon ? <Icon size={12} /> : null;
                })()}
                {t.status.replace("_", " ")}
              </span>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="ml-4 shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            aria-label="Close panel"
            data-testid="close-panel-button"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div
          className="flex-1 overflow-y-auto px-4"
          data-testid="panel-content"
        >
          {/* Overview section with editable priority and complexity */}
          <Section title="Overview">
            <div className="space-y-3">
              {/* Priority */}
              <div className="flex items-center gap-2">
                <span className="w-20 text-xs text-gray-500 dark:text-gray-400">
                  Priority
                </span>
                {editState.activeField === "priority" ? (
                  <div className="flex-1">
                    <FieldEditorWrapper
                      label="Priority"
                      isSaving={editState.isSaving}
                      error={editState.saveError}
                      warning={editState.warning}
                      onSave={() => void saveField()}
                      onCancel={cancelEditing}
                    >
                      <PriorityEditor
                        value={editState.draft.priority}
                        onChange={(v) => updateDraft("priority", v)}
                      />
                    </FieldEditorWrapper>
                  </div>
                ) : (
                  <div className="flex flex-1 items-center justify-between">
                    {priority ? (
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.medium}`}
                      >
                        {priority}
                      </span>
                    ) : (
                      <span className="text-xs italic text-gray-400">
                        Not set
                      </span>
                    )}
                    <EditButton
                      field="priority"
                      activeField={editState.activeField}
                      onClick={startEditing}
                    />
                  </div>
                )}
              </div>

              {/* Complexity */}
              <div className="flex items-center gap-2">
                <span className="w-20 text-xs text-gray-500 dark:text-gray-400">
                  Complexity
                </span>
                {editState.activeField === "complexity" ? (
                  <div className="flex-1">
                    <FieldEditorWrapper
                      label="Complexity"
                      isSaving={editState.isSaving}
                      error={editState.saveError}
                      warning={editState.warning}
                      onSave={() => void saveField()}
                      onCancel={cancelEditing}
                    >
                      <ComplexityEditor
                        value={editState.draft.complexity}
                        onChange={(v) => updateDraft("complexity", v)}
                      />
                    </FieldEditorWrapper>
                  </div>
                ) : (
                  <div className="flex flex-1 items-center justify-between">
                    {complexity ? (
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${COMPLEXITY_COLORS[complexity] ?? COMPLEXITY_COLORS.M}`}
                      >
                        {complexity}
                      </span>
                    ) : (
                      <span className="text-xs italic text-gray-400">
                        Not set
                      </span>
                    )}
                    <EditButton
                      field="complexity"
                      activeField={editState.activeField}
                      onClick={startEditing}
                    />
                  </div>
                )}
              </div>

              {/* Task group (read-only) */}
              {taskGroup && (
                <div className="flex items-center gap-2">
                  <span className="w-20 text-xs text-gray-500 dark:text-gray-400">
                    Group
                  </span>
                  <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">
                    {taskGroup}
                  </span>
                </div>
              )}
            </div>
          </Section>

          {/* Description section */}
          <Section title="Description">
            {t.description ? (
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                data-testid="description-content"
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={markdownComponents}
                >
                  {t.description}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm italic text-gray-400 dark:text-gray-500">
                No description
              </p>
            )}
          </Section>

          {/* Acceptance Criteria section */}
          <SectionWithEdit
            title="Acceptance Criteria"
            field="acceptance_criteria"
            activeField={editState.activeField}
            onEdit={startEditing}
          >
            {editState.activeField === "acceptance_criteria" ? (
              <FieldEditorWrapper
                label="Acceptance Criteria"
                isSaving={editState.isSaving}
                error={editState.saveError}
                warning={editState.warning}
                onSave={() => void saveField()}
                onCancel={cancelEditing}
              >
                <AcceptanceCriteriaEditor
                  value={editState.draft.acceptance_criteria}
                  onChange={(v) => updateDraft("acceptance_criteria", v)}
                />
              </FieldEditorWrapper>
            ) : acceptanceCriteria ? (
              <AcceptanceCriteriaSection criteria={acceptanceCriteria} />
            ) : (
              <p
                className="text-sm italic text-gray-400 dark:text-gray-500"
                data-testid="no-acceptance-criteria"
              >
                No acceptance criteria defined
              </p>
            )}
          </SectionWithEdit>

          {/* Testing Requirements section */}
          <Section title="Testing Requirements">
            {testingRequirements && testingRequirements.length > 0 ? (
              <ul className="space-y-1">
                {testingRequirements.map((req, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
                  >
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400 dark:bg-gray-500" />
                    <span>{typeof req === "string" ? req : `${req.type}: ${req.target}`}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm italic text-gray-400 dark:text-gray-500">
                No testing requirements
              </p>
            )}
          </Section>

          {/* Dependencies section with graph and edit */}
          <SectionWithEdit
            title="Dependencies"
            field="blocked_by"
            activeField={editState.activeField}
            onEdit={startEditing}
          >
            {editState.activeField === "blocked_by" ? (
              <FieldEditorWrapper
                label="Blocked By"
                isSaving={editState.isSaving}
                error={editState.saveError}
                warning={editState.warning}
                onSave={() => void saveField()}
                onCancel={cancelEditing}
              >
                <BlockedByEditor
                  value={editState.draft.blocked_by}
                  onChange={(v) => updateDraft("blocked_by", v)}
                  allTasks={allTasks}
                  currentTaskId={t.id}
                />
              </FieldEditorWrapper>
            ) : (
              <>
                <DependencyGraph
                  task={task}
                  allTasks={allTasks}
                  onNodeClick={onTaskNavigate}
                />
                {blockedBy.length > 0 && (
                  <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-800">
                    <h4 className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                      Blocked By
                    </h4>
                    <DependenciesSection
                      blockedBy={blockedBy}
                      allTasks={allTasks}
                    />
                  </div>
                )}
                {blockedBy.length === 0 && (
                  <DependenciesSection blockedBy={[]} allTasks={allTasks} />
                )}
              </>
            )}
          </SectionWithEdit>

          {/* Metadata section */}
          <Section title="Metadata">
            <div className="space-y-2">
              {taskGroup && (
                <MetadataRow label="Task Group" value={taskGroup} />
              )}
              {specPath && (
                <MetadataRow label="Spec Path" value={specPath} />
              )}
              {sourceSection && (
                <SourceSectionRow
                  sourceSection={sourceSection}
                  specPath={specPath}
                  onViewSpec={onViewSpec}
                />
              )}
              {featureName && (
                <MetadataRow label="Feature Name" value={featureName} />
              )}
              {specPhase !== undefined && specPhase !== null && (
                <MetadataRow label="Spec Phase" value={String(specPhase)} />
              )}
              {!taskGroup &&
                !specPath &&
                !sourceSection &&
                !featureName &&
                specPhase === undefined && (
                  <p className="text-sm italic text-gray-400 dark:text-gray-500">
                    No metadata
                  </p>
                )}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function SourceSectionRow({
  sourceSection,
  specPath,
  onViewSpec,
}: {
  sourceSection: string;
  specPath: string | undefined;
  onViewSpec?: (specPath: string, scrollToSection?: string) => void;
}) {
  const parsed = parseSourceSection(sourceSection);
  const navigable = canNavigateToSpec(specPath, sourceSection);

  if (navigable && parsed && onViewSpec) {
    return (
      <div className="flex items-start gap-3 text-sm">
        <span className="w-28 shrink-0 text-gray-500 dark:text-gray-400">
          Source Section
        </span>
        <button
          onClick={() => onViewSpec(specPath!, parsed.headingText ?? undefined)}
          className="break-all text-left text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          data-testid="source-section-link"
          aria-label={`View spec at ${parsed.displayText}`}
        >
          {parsed.displayText}
        </button>
      </div>
    );
  }

  // Not navigable: missing spec_path or invalid format — show as plain text
  return (
    <div className="flex items-start gap-3 text-sm">
      <span className="w-28 shrink-0 text-gray-500 dark:text-gray-400">
        Source Section
      </span>
      <span
        className="break-all text-gray-800 dark:text-gray-200"
        data-testid="source-section-text"
      >
        {sourceSection}
        {!specPath && parsed && (
          <span
            className="ml-2 text-xs italic text-gray-400 dark:text-gray-500"
            data-testid="source-section-no-spec"
          >
            (no spec path)
          </span>
        )}
      </span>
    </div>
  );
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <span className="w-28 shrink-0 text-gray-500 dark:text-gray-400">
        {label}
      </span>
      <span className="break-all text-gray-800 dark:text-gray-200">
        {value}
      </span>
    </div>
  );
}

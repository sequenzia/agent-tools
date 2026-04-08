import { memo } from "react";
import type { Priority, Complexity } from "../types";
import type { TaskWithPath } from "../services/task-service";

// --- Priority color coding ---

const PRIORITY_COLORS: Record<Priority, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  medium: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  low: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
};

const DEFAULT_PRIORITY_COLOR = PRIORITY_COLORS.medium;

// --- Complexity color coding ---

const COMPLEXITY_COLORS: Record<Complexity, string> = {
  XS: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  S: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
  M: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  L: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  XL: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-300",
};

const DEFAULT_COMPLEXITY_COLOR = COMPLEXITY_COLORS.M;

// --- Badge subcomponents ---

export function PriorityBadge({ priority }: { priority: string }) {
  const colorClass =
    PRIORITY_COLORS[priority as Priority] ?? DEFAULT_PRIORITY_COLOR;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}
      data-testid="priority-badge"
    >
      {priority}
    </span>
  );
}

export function ComplexityBadge({ complexity }: { complexity: string }) {
  const colorClass =
    COMPLEXITY_COLORS[complexity as Complexity] ?? DEFAULT_COMPLEXITY_COLOR;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}
      data-testid="complexity-badge"
    >
      {complexity}
    </span>
  );
}

function DependencyBadge({ count }: { count: number }) {
  return (
    <span
      className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-400"
      data-testid="dependency-badge"
    >
      {count} dep{count !== 1 ? "s" : ""}
    </span>
  );
}

// --- Card content (shared between card and drag overlay) ---

export interface TaskCardContentProps {
  taskWithPath: TaskWithPath;
}

export const TaskCardContent = memo(function TaskCardContent({ taskWithPath }: TaskCardContentProps) {
  const { task } = taskWithPath;
  const priority = task.metadata?.priority as string | undefined;
  const complexity = task.metadata?.complexity as string | undefined;
  const taskGroup = task.metadata?.task_group;
  const taskId = String(task.id);
  const depCount = task.blocked_by?.length ?? 0;

  return (
    <>
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <h4
          className="line-clamp-2 text-sm font-semibold leading-tight text-gray-900 dark:text-gray-100"
          title={task.title}
        >
          {task.title}
        </h4>
        <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
          #{taskId}
        </span>
      </div>

      {taskGroup && (
        <p className="mb-1.5 truncate text-xs text-gray-500 dark:text-gray-400">
          {taskGroup}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1">
        {priority && <PriorityBadge priority={priority} />}
        {complexity && <ComplexityBadge complexity={complexity} />}
        {depCount > 0 && <DependencyBadge count={depCount} />}
      </div>
    </>
  );
});

// --- Main card component with click handler ---

export interface TaskCardProps {
  taskWithPath: TaskWithPath;
  onClick: (twp: TaskWithPath) => void;
  className?: string;
}

export const TaskCard = memo(function TaskCard({ taskWithPath, onClick, className }: TaskCardProps) {
  const taskId = String(taskWithPath.task.id);

  return (
    <div
      className={`rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 dark:border-gray-700 dark:bg-gray-800 ${className ?? ""}`}
      data-testid={`task-card-${taskId}`}
      role="button"
      tabIndex={0}
      aria-label={`Task ${taskWithPath.task.title}`}
      onClick={() => onClick(taskWithPath)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(taskWithPath);
        }
      }}
    >
      <TaskCardContent taskWithPath={taskWithPath} />
    </div>
  );
});

// Re-export color maps for consumers that need them (e.g., KanbanBoard)
export { PRIORITY_COLORS, COMPLEXITY_COLORS };

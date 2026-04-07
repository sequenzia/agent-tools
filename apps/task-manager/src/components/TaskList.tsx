import { useEffect } from "react";
import { useTaskStore } from "../stores/task-store";
import {
  STATUS_ORDER,
  STATUS_LABELS,
  isEmptyTaskList,
  type TaskWithPath,
} from "../services/task-service";
import type { TaskStatus, Priority, Complexity } from "../types";

// --- Badge styling helpers ---

const STATUS_COLORS: Record<TaskStatus, string> = {
  backlog: "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
  pending:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  in_progress:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  completed:
    "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
};

const PRIORITY_COLORS: Record<Priority, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  medium:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  low: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
};

const COMPLEXITY_COLORS: Record<Complexity, string> = {
  XS: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  S: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
  M: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  L: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  XL: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-300",
};

function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status] ?? STATUS_COLORS.backlog}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.medium}`}
    >
      {priority}
    </span>
  );
}

function ComplexityBadge({ complexity }: { complexity: Complexity }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${COMPLEXITY_COLORS[complexity] ?? COMPLEXITY_COLORS.M}`}
    >
      {complexity}
    </span>
  );
}

// --- Task Card ---

function TaskCard({ taskWithPath }: { taskWithPath: TaskWithPath }) {
  const { task } = taskWithPath;
  const priority = task.metadata?.priority as Priority | undefined;
  const complexity = task.metadata?.complexity as Complexity | undefined;
  const taskId = String(task.id);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {task.title}
        </h3>
        <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
          #{taskId}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge status={task.status} />
        {priority && <PriorityBadge priority={priority} />}
        {complexity && <ComplexityBadge complexity={complexity} />}
      </div>
    </div>
  );
}

// --- Status Group ---

function StatusGroup({
  status,
  tasks,
}: {
  status: TaskStatus;
  tasks: TaskWithPath[];
}) {
  if (tasks.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {STATUS_LABELS[status]}
        </h2>
        <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-400">
          {tasks.length}
        </span>
      </div>
      <div className="space-y-2">
        {tasks.map((twp) => (
          <TaskCard key={String(twp.task.id)} taskWithPath={twp} />
        ))}
      </div>
    </section>
  );
}

// --- Loading State ---

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div
        className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600 dark:border-gray-600 dark:border-t-blue-400"
        role="status"
        aria-label="Loading tasks"
      />
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Loading tasks...
      </p>
    </div>
  );
}

// --- Empty State ---

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 py-16 dark:border-gray-600">
      <p className="text-lg font-medium text-gray-500 dark:text-gray-400">
        No tasks found
      </p>
      <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
        Select a project with an .agents/tasks/ directory to view tasks.
      </p>
    </div>
  );
}

// --- Error State ---

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
      <p className="font-medium text-red-800 dark:text-red-300">
        Failed to load tasks
      </p>
      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{message}</p>
    </div>
  );
}

// --- Main TaskList Component ---

interface TaskListProps {
  /** Absolute path to the project root directory. */
  projectPath: string;
}

export function TaskList({ projectPath }: TaskListProps) {
  const { tasks, isLoading, error, fetchTasks } = useTaskStore();

  useEffect(() => {
    fetchTasks(projectPath);
  }, [projectPath, fetchTasks]);

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (!tasks || isEmptyTaskList(tasks)) {
    return <EmptyState />;
  }

  return (
    <div>
      {STATUS_ORDER.map((status) => (
        <StatusGroup key={status} status={status} tasks={tasks[status]} />
      ))}
    </div>
  );
}

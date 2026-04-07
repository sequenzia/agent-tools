import type { WaveProgressState } from "../hooks/use-wave-progress";
import type { ProgressTask, TaskExecutionStatus } from "../services/progress-parser";

/** Props for the WaveProgress component. */
interface WaveProgressProps {
  /** Wave progress state from the useWaveProgress hook. */
  state: WaveProgressState;
}

/** Status badge colors and labels for task execution states. */
const STATUS_CONFIG: Record<
  TaskExecutionStatus,
  { bg: string; text: string; label: string }
> = {
  queued: {
    bg: "bg-gray-100 dark:bg-gray-700",
    text: "text-gray-600 dark:text-gray-300",
    label: "Queued",
  },
  running: {
    bg: "bg-blue-100 dark:bg-blue-900/40",
    text: "text-blue-700 dark:text-blue-300",
    label: "Running",
  },
  passed: {
    bg: "bg-green-100 dark:bg-green-900/40",
    text: "text-green-700 dark:text-green-300",
    label: "Passed",
  },
  partial: {
    bg: "bg-yellow-100 dark:bg-yellow-900/40",
    text: "text-yellow-700 dark:text-yellow-300",
    label: "Partial",
  },
  failed: {
    bg: "bg-red-100 dark:bg-red-900/40",
    text: "text-red-700 dark:text-red-300",
    label: "Failed",
  },
};

/** Renders a status badge for a task. */
function StatusBadge({ status }: { status: TaskExecutionStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${config.bg} ${config.text}`}
      data-testid={`status-badge-${status}`}
    >
      {config.label}
    </span>
  );
}

/** Renders a single task row in the active or completed list. */
function TaskRow({ task }: { task: ProgressTask }) {
  return (
    <li
      className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50"
      data-testid={`task-row-${task.id}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs font-mono text-gray-400 dark:text-gray-500 shrink-0">
          [{task.id}]
        </span>
        <span className="text-sm truncate">{task.title}</span>
      </div>
      <StatusBadge status={task.status} />
    </li>
  );
}

/** Renders the overall progress bar. */
function ProgressBar({
  percentage,
  completedCount,
  totalTasks,
}: {
  percentage: number;
  completedCount: number;
  totalTasks: number;
}) {
  return (
    <div data-testid="progress-bar-container">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Overall Progress
        </span>
        <span
          className="text-sm text-gray-500 dark:text-gray-400"
          data-testid="completion-stats"
        >
          {completedCount} of {totalTasks} completed ({percentage}%)
        </span>
      </div>
      <div
        className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden"
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${percentage}% complete`}
      >
        <div
          className="bg-blue-600 dark:bg-blue-500 h-3 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
          data-testid="progress-bar-fill"
        />
      </div>
    </div>
  );
}

/** Renders the "Initializing..." state when progress.md doesn't exist yet. */
function InitializingState() {
  return (
    <div
      className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6"
      data-testid="wave-progress-initializing"
    >
      <div className="flex items-center gap-3">
        <div className="animate-pulse h-3 w-3 rounded-full bg-blue-500" />
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Initializing execution session...
        </span>
      </div>
    </div>
  );
}

/** Renders a parse error indicator alongside partial data. */
function ParseErrorBanner({ error }: { error: string }) {
  return (
    <div
      className="rounded-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 px-3 py-2 mb-3"
      data-testid="parse-error-banner"
    >
      <span className="text-xs text-yellow-700 dark:text-yellow-300">
        Parse warning: {error}
      </span>
    </div>
  );
}

/**
 * Wave progress display component for the execution dashboard.
 *
 * Shows:
 * - Current wave number and estimated total ("Wave 2 of 5")
 * - Per-task execution status within the current wave (queued/running/passed/partial/failed)
 * - Overall completion percentage bar
 * - Task count: N of M completed
 *
 * The component auto-refreshes as the progress.md file changes on disk
 * via the useWaveProgress hook's polling mechanism.
 */
export function WaveProgress({ state }: WaveProgressProps) {
  const { progress, plan, completionPct, totalTasks, completedCount, isActive, error } =
    state;

  // Not active -- don't render anything.
  if (!isActive) {
    return null;
  }

  // Session active but progress.md not yet created.
  if (!progress) {
    return <InitializingState />;
  }

  const currentWave = progress.currentWave;
  const totalWaves = plan?.totalWaves ?? progress.totalWaves;
  const activeTasks = progress.activeTasks;
  const completedTasks = progress.completedTasks;
  const executionStatus = progress.executionStatus;

  const isComplete = executionStatus.toLowerCase() === "complete";

  return (
    <div
      className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm"
      data-testid="wave-progress"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Execution Progress
            </h3>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                isComplete
                  ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"
                  : "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
              }`}
              data-testid="execution-status-badge"
            >
              {executionStatus}
            </span>
          </div>
          <span
            className="text-sm font-medium text-gray-600 dark:text-gray-400"
            data-testid="wave-indicator"
          >
            Wave {currentWave} of {totalWaves}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Parse error banner */}
        {error && <ParseErrorBanner error={error} />}

        {/* Progress bar */}
        <ProgressBar
          percentage={completionPct}
          completedCount={completedCount}
          totalTasks={totalTasks}
        />

        {/* Active tasks in current wave */}
        {activeTasks.length > 0 && (
          <div data-testid="active-tasks-section">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
              Active Tasks ({activeTasks.length})
            </h4>
            <ul className="space-y-0.5">
              {activeTasks.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </ul>
          </div>
        )}

        {/* Completed tasks summary -- scrollable for large executions */}
        {completedTasks.length > 0 && (
          <div data-testid="completed-tasks-section">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
              Completed This Session ({completedTasks.length})
            </h4>
            <ul className="space-y-0.5 max-h-48 overflow-y-auto">
              {completedTasks.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </ul>
          </div>
        )}

        {/* Empty active state */}
        {activeTasks.length === 0 && !isComplete && (
          <p className="text-sm text-gray-400 dark:text-gray-500 italic">
            No active tasks in current wave
          </p>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import {
  getSpecLifecycle,
  PIPELINE_STAGES,
  STAGE_LABELS,
  type SpecLifecycleInfo,
  type SpecLifecycleStage,
} from "../services/spec-service";

// --- Types ---

interface SpecLifecyclePipelineProps {
  /** Absolute path to the project root directory. */
  projectPath: string;
  /** Spec file path (relative to project root or absolute). */
  specPath: string;
  /** Optional task group name to check for tasks. */
  taskGroup?: string;
}

type StageStatus = "completed" | "current" | "future" | "skipped";

// --- Stage status helpers ---

/**
 * Determine the display status of each pipeline stage based on lifecycle info.
 */
function getStageStatuses(
  lifecycle: SpecLifecycleInfo | null,
): Map<SpecLifecycleStage, StageStatus> {
  const statuses = new Map<SpecLifecycleStage, StageStatus>();

  if (!lifecycle) {
    for (const stage of PIPELINE_STAGES) {
      statuses.set(stage, "future");
    }
    return statuses;
  }

  const completedSet = new Set(lifecycle.completed_stages);
  const currentStage = lifecycle.current_stage;

  for (const stage of PIPELINE_STAGES) {
    if (stage === currentStage) {
      statuses.set(stage, "current");
    } else if (completedSet.has(stage)) {
      statuses.set(stage, "completed");
    } else if (stage === "analyzed" && !lifecycle.has_analysis) {
      // Analysis is optional -- if we're past it without having one, mark skipped
      const currentIdx = PIPELINE_STAGES.indexOf(currentStage);
      const analyzedIdx = PIPELINE_STAGES.indexOf("analyzed");
      if (currentIdx > analyzedIdx) {
        statuses.set(stage, "skipped");
      } else {
        statuses.set(stage, "future");
      }
    } else {
      statuses.set(stage, "future");
    }
  }

  return statuses;
}

// --- Stage icon components ---

function CheckIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function SkipIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311V15a.75.75 0 01-1.5 0v-3.5a.75.75 0 01.75-.75H8.5a.75.75 0 010 1.5H7.058l.158.158a4 4 0 006.672-1.793.75.75 0 111.424.471zm-1.06-6.172a.75.75 0 01-.024 1.06l-.158.158H15.5a.75.75 0 010 1.5H12a.75.75 0 01-.75-.75V3.72a.75.75 0 011.5 0v1.421l.312-.312a5.5 5.5 0 019.201-2.466.75.75 0 11-1.424.471A4 4 0 0014.168 5.17l.084.082z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// --- Stage indicator component ---

function StageIndicator({
  stage,
  status,
  index,
  isLast,
}: {
  stage: SpecLifecycleStage;
  status: StageStatus;
  index: number;
  isLast: boolean;
}) {
  const label = STAGE_LABELS[stage];

  const circleStyles: Record<StageStatus, string> = {
    completed:
      "bg-green-600 text-white dark:bg-green-500",
    current:
      "bg-blue-600 text-white ring-2 ring-blue-300 dark:bg-blue-500 dark:ring-blue-400",
    future:
      "bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500",
    skipped:
      "bg-gray-300 text-gray-500 dark:bg-gray-600 dark:text-gray-400",
  };

  const labelStyles: Record<StageStatus, string> = {
    completed: "text-green-700 dark:text-green-400 font-medium",
    current: "text-blue-700 dark:text-blue-400 font-semibold",
    future: "text-gray-400 dark:text-gray-500",
    skipped: "text-gray-400 dark:text-gray-500 line-through",
  };

  const connectorStyles: Record<StageStatus, string> = {
    completed: "bg-green-600 dark:bg-green-500",
    current: "bg-blue-600 dark:bg-blue-500",
    future: "bg-gray-200 dark:bg-gray-700",
    skipped: "bg-gray-300 dark:bg-gray-600",
  };

  return (
    <div className="flex items-center" data-testid={`stage-${stage}`}>
      {/* Stage circle + label */}
      <div className="flex flex-col items-center">
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs ${circleStyles[status]}`}
          aria-label={`${label}: ${status}`}
          data-testid={`stage-circle-${stage}`}
          data-status={status}
        >
          {status === "completed" ? (
            <CheckIcon />
          ) : status === "skipped" ? (
            <SkipIcon />
          ) : (
            <span>{index + 1}</span>
          )}
        </div>
        <span
          className={`mt-1 text-[10px] leading-tight ${labelStyles[status]} max-w-[80px] text-center`}
          data-testid={`stage-label-${stage}`}
        >
          {label}
        </span>
      </div>

      {/* Connector line to next stage */}
      {!isLast && (
        <div
          className={`mx-1 h-0.5 w-8 self-start mt-3.5 ${connectorStyles[status]}`}
          aria-hidden="true"
          data-testid={`connector-${stage}`}
        />
      )}
    </div>
  );
}

// --- Spec modified indicator ---

function SpecModifiedIndicator() {
  return (
    <div
      className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
      role="status"
      data-testid="spec-modified-indicator"
    >
      <svg
        className="h-3 w-3"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
          clipRule="evenodd"
        />
      </svg>
      <span>Spec modified</span>
    </div>
  );
}

// --- Error/Unknown state ---

function UnknownStageState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div
      className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
      data-testid="unknown-stage"
    >
      <span className="text-xs text-gray-500 dark:text-gray-400">
        Unable to determine pipeline stage
      </span>
      <button
        onClick={onRefresh}
        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
        aria-label="Refresh pipeline status"
        data-testid="refresh-button"
      >
        <RefreshIcon />
        <span>Refresh</span>
      </button>
    </div>
  );
}

// --- Main component ---

export function SpecLifecyclePipeline({
  projectPath,
  specPath,
  taskGroup,
}: SpecLifecyclePipelineProps) {
  const [lifecycle, setLifecycle] = useState<SpecLifecycleInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLifecycle = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const info = await getSpecLifecycle(projectPath, specPath, taskGroup);
      setLifecycle(info);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : "Failed to load lifecycle",
      );
    } finally {
      setIsLoading(false);
    }
  }, [projectPath, specPath, taskGroup]);

  useEffect(() => {
    fetchLifecycle();
  }, [fetchLifecycle]);

  // Listen for file watcher events to refresh lifecycle state
  useEffect(() => {
    let cancelled = false;

    async function setupListener() {
      try {
        const { listen } = await import("@tauri-apps/api/event");

        const unlistenTask = await listen<{ project_path: string }>(
          "task-file-change",
          (event) => {
            if (!cancelled && event.payload.project_path === projectPath) {
              fetchLifecycle();
            }
          },
        );

        const unlistenSession = await listen<{ project_path: string }>(
          "session-change",
          (event) => {
            if (!cancelled && event.payload.project_path === projectPath) {
              fetchLifecycle();
            }
          },
        );

        return () => {
          cancelled = true;
          unlistenTask();
          unlistenSession();
        };
      } catch {
        // Event API not available (e.g., in tests)
        return () => {
          cancelled = true;
        };
      }
    }

    const cleanupPromise = setupListener();

    return () => {
      cancelled = true;
      cleanupPromise.then((cleanup) => cleanup?.());
    };
  }, [projectPath, fetchLifecycle]);

  // Loading skeleton
  if (isLoading && !lifecycle) {
    return (
      <div
        className="flex items-center gap-2 px-4 py-3"
        data-testid="pipeline-loading"
      >
        {PIPELINE_STAGES.map((stage, idx) => (
          <div key={stage} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className="h-7 w-7 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
              <div className="mt-1 h-2 w-12 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            </div>
            {idx < PIPELINE_STAGES.length - 1 && (
              <div className="mx-1 h-0.5 w-8 self-start mt-3.5 bg-gray-200 dark:bg-gray-700" />
            )}
          </div>
        ))}
      </div>
    );
  }

  // Error state with refresh
  if (error || (lifecycle && lifecycle.current_stage === "unknown")) {
    return (
      <div className="px-4 py-2" data-testid="pipeline-error">
        <UnknownStageState onRefresh={fetchLifecycle} />
      </div>
    );
  }

  if (!lifecycle) {
    return null;
  }

  const stageStatuses = getStageStatuses(lifecycle);

  return (
    <div
      className="border-b border-gray-200 px-4 py-3 dark:border-gray-700"
      data-testid="spec-lifecycle-pipeline"
    >
      <div className="flex items-start">
        {/* Pipeline stages */}
        <div className="flex items-start">
          {PIPELINE_STAGES.map((stage, idx) => (
            <StageIndicator
              key={stage}
              stage={stage}
              status={stageStatuses.get(stage) ?? "future"}
              index={idx}
              isLast={idx === PIPELINE_STAGES.length - 1}
            />
          ))}
        </div>

        {/* Task progress indicator */}
        {lifecycle.total_tasks > 0 && (
          <div
            className="ml-4 flex items-center gap-1.5 self-start mt-1"
            data-testid="task-progress"
          >
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {lifecycle.completed_tasks}/{lifecycle.total_tasks} tasks
            </span>
          </div>
        )}

        {/* Spec modified warning */}
        {lifecycle.spec_modified_after_tasks && (
          <div className="ml-3 self-start mt-0.5">
            <SpecModifiedIndicator />
          </div>
        )}
      </div>
    </div>
  );
}

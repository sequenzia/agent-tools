import { useRef, useEffect } from "react";
import type { SessionTimelineState } from "../hooks/use-session-timeline";
import type {
  TimelineEvent,
  TimelineEventType,
  TimelineSummary,
} from "../services/timeline-service";

/** Props for the SessionTimeline component. */
interface SessionTimelineProps {
  /** Timeline state from the useSessionTimeline hook. */
  state: SessionTimelineState;
}

/** Color configuration per event type. */
const EVENT_COLORS: Record<
  TimelineEventType,
  { dot: string; border: string; bg: string; text: string; label: string }
> = {
  started: {
    dot: "bg-blue-500",
    border: "border-blue-200 dark:border-blue-800",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    text: "text-blue-700 dark:text-blue-300",
    label: "Started",
  },
  completed: {
    dot: "bg-green-500",
    border: "border-green-200 dark:border-green-800",
    bg: "bg-green-50 dark:bg-green-900/20",
    text: "text-green-700 dark:text-green-300",
    label: "Completed",
  },
  failed: {
    dot: "bg-red-500",
    border: "border-red-200 dark:border-red-800",
    bg: "bg-red-50 dark:bg-red-900/20",
    text: "text-red-700 dark:text-red-300",
    label: "Failed",
  },
};

/** Badge showing the event type. */
function EventTypeBadge({ type }: { type: TimelineEventType }) {
  const config = EVENT_COLORS[type];
  return (
    <span
      data-testid={`event-badge-${type}`}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${config.bg} ${config.text}`}
    >
      {config.label}
    </span>
  );
}

/** A single timeline entry. */
function TimelineEntry({ event }: { event: TimelineEvent }) {
  const config = EVENT_COLORS[event.type];

  return (
    <div
      data-testid={`timeline-event-${event.taskId}-${event.type}`}
      className="relative flex gap-3 pb-4"
    >
      {/* Vertical line */}
      <div className="flex flex-col items-center">
        <div className={`h-3 w-3 rounded-full ${config.dot} shrink-0 mt-1`} />
        <div className="w-px flex-1 bg-gray-200 dark:bg-gray-700" />
      </div>

      {/* Event content */}
      <div
        className={`flex-1 rounded-lg border ${config.border} px-3 py-2 min-w-0`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-mono text-gray-400 dark:text-gray-500 shrink-0">
              [{event.taskId}]
            </span>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {event.title}
            </span>
          </div>
          <EventTypeBadge type={event.type} />
        </div>

        {/* Duration and attempts for completed/failed events */}
        {(event.type === "completed" || event.type === "failed") && (
          <div className="mt-1 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            {event.duration && (
              <span data-testid={`duration-${event.taskId}`}>
                Duration: {event.duration}
              </span>
            )}
            {event.attempts && (
              <span data-testid={`attempts-${event.taskId}`}>
                Attempts: {event.attempts}
              </span>
            )}
            {event.status && (
              <span data-testid={`status-${event.taskId}`}>
                Status: {event.status}
              </span>
            )}
          </div>
        )}

        {/* Malformed warning */}
        {event.isMalformed && (
          <span
            className="text-xs text-orange-500"
            title="This entry had parsing issues"
            data-testid={`malformed-${event.taskId}`}
          >
            (!)
          </span>
        )}
      </div>
    </div>
  );
}

/** Summary statistics bar at the top. */
function SummaryStats({ summary }: { summary: TimelineSummary }) {
  return (
    <div
      data-testid="timeline-summary"
      className="grid grid-cols-2 gap-3 sm:grid-cols-4"
    >
      <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 px-3 py-2">
        <div
          className="text-lg font-semibold text-gray-900 dark:text-gray-100"
          data-testid="summary-total-duration"
        >
          {summary.totalDuration}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Total Duration
        </div>
      </div>

      <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 px-3 py-2">
        <div
          className="text-lg font-semibold text-gray-900 dark:text-gray-100"
          data-testid="summary-tasks-completed"
        >
          {summary.tasksCompleted}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Tasks Completed
        </div>
      </div>

      <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 px-3 py-2">
        <div
          className="text-lg font-semibold text-gray-900 dark:text-gray-100"
          data-testid="summary-avg-duration"
        >
          {summary.averageDuration}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Avg Task Time
        </div>
      </div>

      <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 px-3 py-2">
        <div className="flex items-center gap-2">
          <span
            className="text-lg font-semibold text-green-600 dark:text-green-400"
            data-testid="summary-passed"
          >
            {summary.tasksPassed}
          </span>
          <span className="text-gray-400">/</span>
          <span
            className="text-lg font-semibold text-red-600 dark:text-red-400"
            data-testid="summary-failed"
          >
            {summary.tasksFailed}
          </span>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Passed / Failed
        </div>
      </div>
    </div>
  );
}

/** Placeholder shown when task_log.md doesn't exist yet. */
function ExecutionStartingPlaceholder() {
  return (
    <div
      data-testid="timeline-placeholder"
      className="flex items-center gap-3 p-4"
    >
      <div className="animate-pulse h-3 w-3 rounded-full bg-blue-500" />
      <span className="text-sm text-gray-500 dark:text-gray-400">
        Execution starting...
      </span>
    </div>
  );
}

/** Parse error/warning banner. */
function ParseWarningBanner({
  error,
  malformedCount,
}: {
  error: string | null;
  malformedCount: number;
}) {
  if (!error && malformedCount === 0) return null;

  return (
    <div
      data-testid="timeline-warning"
      className="rounded-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 px-3 py-2"
    >
      <span className="text-xs text-yellow-700 dark:text-yellow-300">
        {error && <>Parse warning: {error} </>}
        {malformedCount > 0 && (
          <>
            {malformedCount} malformed{" "}
            {malformedCount === 1 ? "entry" : "entries"} skipped
          </>
        )}
      </span>
    </div>
  );
}

/**
 * Session timeline component showing chronological task execution events.
 *
 * Displays:
 * - Summary statistics: total duration, tasks completed, avg task time, pass/fail
 * - Vertical timeline of events color-coded by type (started=blue, completed=green, failed=red)
 * - Auto-scrolls to latest event during live execution
 * - Scrollable for long executions (50+ events)
 */
export function SessionTimeline({ state }: SessionTimelineProps) {
  const { timeline, isActive, error } = state;
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevEventCountRef = useRef(0);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (!timeline || !scrollRef.current) return;

    const currentCount = timeline.events.length;
    if (currentCount > prevEventCountRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    prevEventCountRef.current = currentCount;
  }, [timeline]);

  // Not active -- don't render.
  if (!isActive) {
    return null;
  }

  // Session active but no timeline data yet (task_log.md not created).
  if (!timeline || timeline.events.length === 0) {
    return (
      <div
        data-testid="session-timeline"
        className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm"
      >
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Session Timeline
          </h3>
        </div>
        <ExecutionStartingPlaceholder />
      </div>
    );
  }

  return (
    <div
      data-testid="session-timeline"
      className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm flex flex-col"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Session Timeline
        </h3>
      </div>

      {/* Summary stats (always visible at top) */}
      <div className="px-4 pt-3" data-testid="timeline-summary-section">
        <SummaryStats summary={timeline.summary} />
      </div>

      {/* Parse warning */}
      {(error || timeline.malformedCount > 0) && (
        <div className="px-4 pt-2">
          <ParseWarningBanner
            error={error}
            malformedCount={timeline.malformedCount}
          />
        </div>
      )}

      {/* Timeline events (scrollable) */}
      <div
        ref={scrollRef}
        data-testid="timeline-events"
        className="flex-1 overflow-y-auto px-4 pt-3 pb-2 max-h-96"
      >
        {timeline.events.map((event) => (
          <TimelineEntry
            key={`${event.taskId}-${event.type}`}
            event={event}
          />
        ))}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState, useCallback, useRef, memo, lazy, Suspense } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useTaskStore } from "../stores/task-store";
import { useProjectStore } from "../stores/project-store";
import { useToastStore } from "../stores/toast-store";
import {
  isEmptyTaskList,
  moveTask,
  type TaskWithPath,
  type TasksByStatus,
} from "../services/task-service";
import { withIpcTimeout, classifyIpcError, IpcError } from "../services/ipc-error-handler";
import { ErrorBoundary } from "./ErrorBoundary";
import { TaskCardContent } from "./TaskCard";
import {
  validateTransition,
  COLUMN_TO_STATUS,
  type TransitionResult,
} from "../services/transition-validation";
import {
  useKeyboardNavigation,
  type KeyboardDndState,
} from "../hooks/use-keyboard-navigation";
import { COLUMN_ICONS } from "./StatusIcon";
import { useLiveAnnouncer } from "./LiveRegion";
import { perfMonitor } from "../services/perf-monitor";
import type { TaskStatus } from "../types";

// Lazy-loaded panels for code splitting
const LazySpecViewerPanel = lazy(() => import("./SpecViewerPanel").then((m) => ({ default: m.SpecViewerPanel })));
const LazyTaskDetailPanel = lazy(() => import("./TaskDetailPanel").then((m) => ({ default: m.TaskDetailPanel })));

// --- Board column types ---

/** Columns displayed on the kanban board. Includes filesystem statuses and derived UI states. */
export type BoardColumn =
  | "backlog"
  | "pending"
  | "blocked"
  | "in_progress"
  | "failed"
  | "completed";

/** Ordered list of board columns for rendering. */
export const BOARD_COLUMNS: BoardColumn[] = [
  "backlog",
  "pending",
  "blocked",
  "in_progress",
  "failed",
  "completed",
];

/** Human-readable labels for each board column. */
export const COLUMN_LABELS: Record<BoardColumn, string> = {
  backlog: "Backlog",
  pending: "Pending",
  blocked: "Blocked",
  in_progress: "In Progress",
  failed: "Failed",
  completed: "Completed",
};

/** Color classes for column header accents. */
const COLUMN_HEADER_COLORS: Record<BoardColumn, string> = {
  backlog: "bg-gray-400 dark:bg-gray-500",
  pending: "bg-yellow-400 dark:bg-yellow-500",
  blocked: "bg-orange-400 dark:bg-orange-500",
  in_progress: "bg-blue-400 dark:bg-blue-500",
  failed: "bg-red-400 dark:bg-red-500",
  completed: "bg-green-400 dark:bg-green-500",
};

/** Timeout for IPC write operations (ms). */
const IPC_TIMEOUT_MS = 5000;

// --- Derived state helpers ---

/**
 * Check if a pending task is "blocked" — it has blocked_by references
 * pointing to tasks that are NOT completed.
 */
export function isBlockedTask(
  task: TaskWithPath,
  allTasks: TasksByStatus,
): boolean {
  const blockedBy = task.task.blocked_by;
  if (!blockedBy || blockedBy.length === 0) return false;

  const completedIds = new Set(
    allTasks.completed.map((t) => String(t.task.id)),
  );

  return blockedBy.some((depId) => !completedIds.has(String(depId)));
}

/**
 * Check if a pending task is "failed" — it was returned to pending
 * after a failed verification attempt.
 *
 * Identified by the presence of a `last_result` field with value
 * "FAIL" or "PARTIAL" in the task data (via passthrough fields).
 */
export function isFailedTask(task: TaskWithPath): boolean {
  const rawTask = task.task as Record<string, unknown>;
  const lastResult = rawTask.last_result;
  if (typeof lastResult === "string") {
    const normalized = lastResult.toUpperCase();
    return normalized === "FAIL" || normalized === "PARTIAL";
  }
  return false;
}

/** Tasks organized into board columns (including derived states). */
export interface BoardTasks {
  backlog: TaskWithPath[];
  pending: TaskWithPath[];
  blocked: TaskWithPath[];
  in_progress: TaskWithPath[];
  failed: TaskWithPath[];
  completed: TaskWithPath[];
  unknown: TaskWithPath[];
}

/**
 * Derive board column assignments from the task store data.
 * Pending tasks are split into Pending, Blocked, and Failed columns.
 * Tasks with unrecognized status values go into "unknown".
 */
export function deriveBoardTasks(tasks: TasksByStatus): BoardTasks {
  const result: BoardTasks = {
    backlog: [...tasks.backlog],
    pending: [],
    blocked: [],
    in_progress: [...tasks.in_progress],
    failed: [],
    completed: [...tasks.completed],
    unknown: [],
  };

  for (const twp of tasks.pending) {
    if (isFailedTask(twp)) {
      result.failed.push(twp);
    } else if (isBlockedTask(twp, tasks)) {
      result.blocked.push(twp);
    } else {
      result.pending.push(twp);
    }
  }

  return result;
}

/**
 * Filter board tasks by selected task groups.
 * If no groups are selected (empty set), returns all tasks unfiltered.
 * Tasks without a task_group metadata field are excluded when a filter is active.
 */
export function filterBoardTasksByGroups(
  board: BoardTasks,
  groups: Set<string>,
): BoardTasks {
  if (groups.size === 0) return board;

  function filterList(list: TaskWithPath[]): TaskWithPath[] {
    return list.filter((twp) => {
      const group = twp.task.metadata?.task_group;
      return typeof group === "string" && groups.has(group);
    });
  }

  return {
    backlog: filterList(board.backlog),
    pending: filterList(board.pending),
    blocked: filterList(board.blocked),
    in_progress: filterList(board.in_progress),
    failed: filterList(board.failed),
    completed: filterList(board.completed),
    unknown: filterList(board.unknown),
  };
}

// --- Board Filter Bar ---

function BoardFilterBar({
  activeGroups,
  availableGroups,
  onToggleGroup,
  onClearFilter,
}: {
  activeGroups: Set<string>;
  availableGroups: string[];
  onToggleGroup: (group: string) => void;
  onClearFilter: () => void;
}) {
  if (availableGroups.length === 0) return null;

  return (
    <div
      className="flex items-center gap-2 border-b border-gray-200 px-4 py-2 dark:border-gray-700"
      data-testid="board-filter-bar"
      role="toolbar"
      aria-label="Task group filters"
    >
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
        Filter:
      </span>
      <button
        type="button"
        className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
          activeGroups.size === 0
            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
        }`}
        onClick={onClearFilter}
        data-testid="filter-all"
        aria-pressed={activeGroups.size === 0}
        aria-label="Show all task groups"
      >
        All
      </button>
      {availableGroups.map((group) => (
        <button
          key={group}
          type="button"
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
            activeGroups.has(group)
              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
          }`}
          onClick={() => onToggleGroup(group)}
          data-testid={`filter-group-${group}`}
          aria-pressed={activeGroups.has(group)}
          aria-label={`Filter by task group: ${group}`}
        >
          {group}
        </button>
      ))}
    </div>
  );
}

// --- Draggable Task Card ---

const KanbanCard = memo(function KanbanCard({
  taskWithPath,
  column,
  onClick,
  isLocked,
  isRollingBack,
  isKeyboardFocused,
  isKeyboardDragging,
}: {
  taskWithPath: TaskWithPath;
  column: BoardColumn;
  onClick: (twp: TaskWithPath) => void;
  isLocked: boolean;
  isRollingBack: boolean;
  isKeyboardFocused: boolean;
  isKeyboardDragging: boolean;
}) {
  const taskId = String(taskWithPath.task.id);
  const dragId = `task-${taskId}-${column}`;
  const cardRef = useRef<HTMLDivElement>(null);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId,
    data: { taskWithPath, column },
    disabled: isLocked,
  });

  // Scroll into view and focus when keyboard-navigated
  useEffect(() => {
    if (isKeyboardFocused && cardRef.current) {
      cardRef.current.focus({ preventScroll: false });
      if (typeof cardRef.current.scrollIntoView === "function") {
        cardRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [isKeyboardFocused]);

  // Merge refs
  const mergedRef = useCallback(
    (node: HTMLDivElement | null) => {
      (cardRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      setNodeRef(node);
    },
    [setNodeRef],
  );

  const focusClasses = isKeyboardFocused
    ? "ring-2 ring-blue-500 ring-offset-2 dark:ring-blue-400 dark:ring-offset-gray-900"
    : "";

  const dndClasses = isKeyboardDragging
    ? "ring-2 ring-purple-500 ring-offset-2 animate-pulse dark:ring-purple-400"
    : "";

  return (
    <div
      ref={mergedRef}
      {...(isLocked ? {} : listeners)}
      {...attributes}
      className={`rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-all duration-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 ${
        isDragging ? "opacity-30" : ""
      } ${isLocked ? "cursor-not-allowed opacity-70" : "cursor-grab active:cursor-grabbing"} ${
        isRollingBack ? "animate-pulse ring-2 ring-red-300 dark:ring-red-600" : ""
      } ${focusClasses} ${dndClasses}`}
      data-testid={`task-card-${taskId}`}
      data-locked={isLocked ? "true" : undefined}
      data-keyboard-focused={isKeyboardFocused ? "true" : undefined}
      data-keyboard-dragging={isKeyboardDragging ? "true" : undefined}
      role="button"
      tabIndex={0}
      aria-roledescription="draggable task card"
      aria-label={`Task ${taskWithPath.task.title}`}
      aria-grabbed={isKeyboardDragging ? true : undefined}
      onClick={() => {
        if (!isDragging) onClick(taskWithPath);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          // Let the board-level handler manage these
          // but prevent default to avoid page scrolling on space
          if (e.key === " ") e.preventDefault();
        }
      }}
    >
      <TaskCardContent taskWithPath={taskWithPath} />
    </div>
  );
});

// --- Virtual scrolling constants ---
const CARD_HEIGHT = 88; // ~80px card + 8px gap (space-y-2)
const VIRTUAL_THRESHOLD = 50; // Activate virtual scrolling above this count

// --- Virtual Column Cards ---
// Extracted card rendering with virtual scroll support for 100+ card columns.

/** Compute virtual scroll slice for a given item count, scroll state, and container height. */
function computeVirtualSlice(
  itemCount: number,
  itemHeight: number,
  scrollTop: number,
  containerHeight: number,
  overscan: number,
  threshold: number,
): { isVirtual: boolean; startIndex: number; endIndex: number; topPadding: number; bottomPadding: number } {
  if (itemCount <= threshold) {
    return { isVirtual: false, startIndex: 0, endIndex: itemCount, topPadding: 0, bottomPadding: 0 };
  }

  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.ceil((scrollTop + containerHeight) / itemHeight);
  const startIndex = Math.max(0, visibleStart - overscan);
  const endIndex = Math.min(itemCount, visibleEnd + overscan);
  const topPadding = startIndex * itemHeight;
  const bottomPadding = Math.max(0, (itemCount - endIndex) * itemHeight);

  return { isVirtual: true, startIndex, endIndex, topPadding, bottomPadding };
}

function VirtualColumnCards({
  tasks,
  column,
  onCardClick,
  lockedTaskIds,
  rollingBackTaskIds,
  keyboardFocusedCardIndex,
  keyboardDndState,
  keyboardDraggingTaskId,
}: {
  tasks: TaskWithPath[];
  column: BoardColumn;
  onCardClick: (twp: TaskWithPath) => void;
  lockedTaskIds: Set<string>;
  rollingBackTaskIds: Set<string>;
  keyboardFocusedCardIndex: number;
  keyboardDndState: KeyboardDndState | null;
  keyboardDraggingTaskId: string | null;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  // Callback ref to capture container height
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      setContainerHeight(node.clientHeight);
    }
  }, []);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const vSlice = useMemo(
    () => computeVirtualSlice(tasks.length, CARD_HEIGHT, scrollTop, containerHeight, 5, VIRTUAL_THRESHOLD),
    [tasks.length, scrollTop, containerHeight],
  );

  if (tasks.length === 0) {
    return (
      <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2">
        <p
          className="py-8 text-center text-xs text-gray-400 dark:text-gray-500"
          data-testid={`empty-${column}`}
        >
          No tasks
        </p>
      </div>
    );
  }

  const visibleTasks = vSlice.isVirtual
    ? tasks.slice(vSlice.startIndex, vSlice.endIndex)
    : tasks;

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-2 pb-2"
      onScroll={handleScroll}
      data-testid={`column-cards-${column}`}
      data-virtual={vSlice.isVirtual ? "true" : undefined}
    >
      {vSlice.isVirtual && vSlice.topPadding > 0 && (
        <div style={{ height: vSlice.topPadding }} aria-hidden="true" />
      )}
      <div className="space-y-2">
        {visibleTasks.map((twp, visibleIdx) => {
          const idx = vSlice.isVirtual
            ? vSlice.startIndex + visibleIdx
            : visibleIdx;
          const tid = String(twp.task.id);
          return (
            <KanbanCard
              key={tid}
              taskWithPath={twp}
              column={column}
              onClick={onCardClick}
              isLocked={lockedTaskIds.has(tid)}
              isRollingBack={rollingBackTaskIds.has(tid)}
              isKeyboardFocused={keyboardFocusedCardIndex === idx && !keyboardDndState}
              isKeyboardDragging={keyboardDraggingTaskId === tid}
            />
          );
        })}
      </div>
      {vSlice.isVirtual && vSlice.bottomPadding > 0 && (
        <div style={{ height: vSlice.bottomPadding }} aria-hidden="true" />
      )}
    </div>
  );
}

// --- Droppable Column ---

function KanbanColumn({
  column,
  tasks,
  onCardClick,
  isOver,
  transitionResult,
  lockedTaskIds,
  rollingBackTaskIds,
  keyboardFocusedCardIndex,
  keyboardDndState,
}: {
  column: BoardColumn;
  tasks: TaskWithPath[];
  onCardClick: (twp: TaskWithPath) => void;
  isOver: boolean;
  transitionResult: TransitionResult | null;
  lockedTaskIds: Set<string>;
  rollingBackTaskIds: Set<string>;
  keyboardFocusedCardIndex: number;
  keyboardDndState: KeyboardDndState | null;
}) {
  const { setNodeRef } = useDroppable({
    id: `column-${column}`,
    data: { column },
  });

  // Determine if this column is the keyboard DnD target
  const isKeyboardDndTarget =
    keyboardDndState !== null && keyboardDndState.targetColumn === column;
  const keyboardDndAllowed =
    isKeyboardDndTarget && keyboardDndState.transitionResult.allowed;
  const keyboardDndRejected =
    isKeyboardDndTarget && !keyboardDndState.transitionResult.allowed;

  // Determine drop target visual state
  let dropStateClass = "";
  if (isOver && transitionResult) {
    if (transitionResult.allowed) {
      dropStateClass =
        "ring-2 ring-blue-400 bg-blue-50/50 dark:ring-blue-500 dark:bg-blue-900/20";
    } else {
      dropStateClass =
        "ring-2 ring-red-400 bg-red-50/50 dark:ring-red-500 dark:bg-red-900/20";
    }
  } else if (keyboardDndAllowed) {
    dropStateClass =
      "ring-2 ring-blue-400 bg-blue-50/50 dark:ring-blue-500 dark:bg-blue-900/20";
  } else if (keyboardDndRejected) {
    dropStateClass =
      "ring-2 ring-red-400 bg-red-50/50 dark:ring-red-500 dark:bg-red-900/20";
  }

  // Determine which task is being keyboard-dragged (for visual highlight on the card)
  const keyboardDraggingTaskId =
    keyboardDndState ? String(keyboardDndState.task.task.id) : null;

  return (
    <div
      ref={setNodeRef}
      className={`flex h-full w-72 min-w-72 flex-col rounded-lg bg-gray-50 transition-all duration-150 dark:bg-gray-900 ${dropStateClass}`}
      data-testid={`column-${column}`}
      data-keyboard-dnd-target={isKeyboardDndTarget ? "true" : undefined}
      role="region"
      aria-label={`${COLUMN_LABELS[column]} column, ${tasks.length} tasks`}
      aria-dropeffect={isOver ? "move" : "none"}
    >
      {/* Column header with dual indicator (color dot + icon) */}
      <div className="flex items-center gap-2 px-3 py-3">
        <div
          className={`h-2.5 w-2.5 rounded-full ${COLUMN_HEADER_COLORS[column]}`}
          aria-hidden="true"
        />
        {(() => {
          const Icon = COLUMN_ICONS[column];
          return Icon ? <Icon size={14} className="shrink-0 text-gray-500 dark:text-gray-400" /> : null;
        })()}
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {COLUMN_LABELS[column]}
        </h3>
        <span
          className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-400"
          aria-label={`${tasks.length} tasks`}
        >
          {tasks.length}
        </span>
      </div>

      {/* Rejection tooltip — mouse DnD */}
      {isOver && transitionResult && !transitionResult.allowed && (
        <div
          className="mx-2 mb-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/40 dark:text-red-300"
          data-testid={`rejection-${column}`}
          role="alert"
        >
          {transitionResult.reason}
        </div>
      )}

      {/* Rejection tooltip — keyboard DnD */}
      {keyboardDndRejected && keyboardDndState && (
        <div
          className="mx-2 mb-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/40 dark:text-red-300"
          data-testid={`kb-rejection-${column}`}
          role="alert"
        >
          {keyboardDndState.transitionResult.reason}
        </div>
      )}

      {/* Keyboard DnD drop hint */}
      {isKeyboardDndTarget && keyboardDndAllowed && keyboardDndState.fromColumn !== column && (
        <div
          className="mx-2 mb-2 rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
          data-testid={`kb-drop-hint-${column}`}
        >
          Press Enter to drop here
        </div>
      )}

      {/* Cards area - scrollable with virtual scrolling for large lists */}
      <VirtualColumnCards
        tasks={tasks}
        column={column}
        onCardClick={onCardClick}
        lockedTaskIds={lockedTaskIds}
        rollingBackTaskIds={rollingBackTaskIds}
        keyboardFocusedCardIndex={keyboardFocusedCardIndex}
        keyboardDndState={keyboardDndState}
        keyboardDraggingTaskId={keyboardDraggingTaskId}
      />
    </div>
  );
}

// --- Drag Overlay Card ---

function DragOverlayCard({ taskWithPath }: { taskWithPath: TaskWithPath }) {
  return (
    <div
      className="w-72 rounded-lg border border-blue-300 bg-white p-3 shadow-lg dark:border-blue-600 dark:bg-gray-800"
      data-testid="drag-overlay"
    >
      <TaskCardContent taskWithPath={taskWithPath} />
    </div>
  );
}

// --- Unknown tasks section ---

function UnknownTasksSection({ tasks }: { tasks: TaskWithPath[] }) {
  if (tasks.length === 0) return null;

  return (
    <div
      className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20"
      data-testid="unknown-section"
    >
      <p className="mb-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
        Unknown Status ({tasks.length})
      </p>
      <div className="space-y-2">
        {tasks.map((twp) => (
          <div
            key={String(twp.task.id)}
            className="rounded border border-amber-200 bg-white p-2 text-sm dark:border-amber-700 dark:bg-gray-800"
          >
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {twp.task.title}
            </span>
            <span className="ml-2 text-xs text-gray-400">
              #{String(twp.task.id)} (status: {twp.task.status})
            </span>
          </div>
        ))}
      </div>
    </div>
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

// --- Main KanbanBoard Component ---

interface KanbanBoardProps {
  /** Absolute path to the project root directory. */
  projectPath: string;
}

export function KanbanBoard({ projectPath }: KanbanBoardProps) {
  const {
    tasks,
    isLoading,
    error,
    fetchTasks,
    lockedTaskIds,
    moveTaskOptimistic,
    confirmMove,
    rollbackMove,
    isTaskLocked,
  } = useTaskStore();
  const { activeTaskGroups, toggleTaskGroup, setActiveTaskGroups } =
    useProjectStore();
  const { announce } = useLiveAnnouncer();
  const [selectedTask, setSelectedTask] = useState<TaskWithPath | null>(null);

  // Track spec viewer state for task-to-spec section linking
  const [specViewerState, setSpecViewerState] = useState<{
    specPath: string;
    scrollToSection?: string;
  } | null>(null);

  // Track active drag state
  const [activeTask, setActiveTask] = useState<TaskWithPath | null>(null);
  const [activeColumn, setActiveColumn] = useState<BoardColumn | null>(null);
  const [overColumn, setOverColumn] = useState<BoardColumn | null>(null);
  const [overTransition, setOverTransition] =
    useState<TransitionResult | null>(null);

  // Global toast store for error notifications
  const addToastGlobal = useToastStore((s) => s.addToast);

  // Track tasks currently animating rollback
  const [rollingBackTaskIds, setRollingBackTaskIds] = useState<Set<string>>(new Set());

  // Guard against rapid drags producing inconsistent state
  const isDraggingRef = useRef(false);

  // Board container ref for keyboard event handling
  const boardContainerRef = useRef<HTMLDivElement>(null);

  const addToast = useCallback((taskTitle: string, message: string) => {
    addToastGlobal("error", `Move failed: ${taskTitle}`, message);
  }, [addToastGlobal]);

  const handleCardClick = useCallback((twp: TaskWithPath) => {
    setSelectedTask(twp);
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedTask(null);
  }, []);

  const handleTaskUpdated = useCallback(
    (updated: TaskWithPath) => {
      setSelectedTask(updated);
      void fetchTasks(projectPath);
    },
    [fetchTasks, projectPath],
  );

  const handleTaskNavigate = useCallback(
    (navigatedTask: TaskWithPath | null) => {
      if (navigatedTask) {
        setSelectedTask(navigatedTask);
      }
    },
    [],
  );

  const handleViewSpec = useCallback(
    (specPath: string, scrollToSection?: string) => {
      setSpecViewerState({ specPath, scrollToSection });
    },
    [],
  );

  const handleCloseSpecViewer = useCallback(() => {
    setSpecViewerState(null);
  }, []);

  useEffect(() => {
    perfMonitor.mark("fetch-tasks");
    fetchTasks(projectPath).then(() => {
      perfMonitor.measure("fetch-tasks", { projectPath });
    });
  }, [projectPath, fetchTasks]);

  const boardTasks = useMemo<BoardTasks | null>(() => {
    if (!tasks) return null;
    const derived = deriveBoardTasks(tasks);
    return filterBoardTasksByGroups(derived, activeTaskGroups);
  }, [tasks, activeTaskGroups]);

  // Collect available group names from all tasks for the filter bar
  const availableGroups = useMemo<string[]>(() => {
    if (!tasks) return [];
    const groups = new Set<string>();
    const allLists = [tasks.backlog, tasks.pending, tasks.in_progress, tasks.completed];
    for (const list of allLists) {
      for (const twp of list) {
        const group = twp.task.metadata?.task_group;
        if (typeof group === "string") {
          groups.add(group);
        }
      }
    }
    return Array.from(groups).sort();
  }, [tasks]);

  const handleClearFilter = useCallback(() => {
    setActiveTaskGroups(null);
  }, [setActiveTaskGroups]);

  // --- Keyboard move handler (shared with keyboard DnD) ---
  const performKeyboardMove = useCallback(
    (taskWithPath: TaskWithPath, fromColumn: BoardColumn, toColumn: BoardColumn) => {
      if (fromColumn === toColumn || !tasks) return;

      const result = validateTransition(taskWithPath, fromColumn, toColumn, tasks);
      if (!result.allowed) return;

      const newStatus = COLUMN_TO_STATUS[toColumn];
      if (!newStatus) return;

      const taskId = String(taskWithPath.task.id);
      if (isTaskLocked(taskId)) return;

      moveTaskOptimistic(taskWithPath, newStatus as TaskStatus);

      void (async () => {
        try {
          const writeResult = await withIpcTimeout(
            moveTask(taskWithPath.filePath, newStatus, taskWithPath.mtimeMs),
            IPC_TIMEOUT_MS,
          );

          const updatedTask: TaskWithPath = {
            task: {
              ...taskWithPath.task,
              status: newStatus as TaskStatus,
            },
            filePath: writeResult.filePath,
            mtimeMs: writeResult.mtimeMs,
          };

          confirmMove(taskId, updatedTask);
          announce(`Task ${taskWithPath.task.title} moved to ${COLUMN_LABELS[toColumn]}`);
        } catch (err) {
          setRollingBackTaskIds((prev) => {
            const next = new Set(prev);
            next.add(taskId);
            return next;
          });

          rollbackMove(taskId);

          const classified = err instanceof IpcError ? err : classifyIpcError(err);
          addToast(taskWithPath.task.title, classified.message);
          announce(`Failed to move task ${taskWithPath.task.title}`, "assertive");

          setTimeout(() => {
            setRollingBackTaskIds((prev) => {
              const next = new Set(prev);
              next.delete(taskId);
              return next;
            });
          }, 600);
        }
      })();
    },
    [tasks, moveTaskOptimistic, confirmMove, rollbackMove, isTaskLocked, addToast, announce],
  );

  // --- Keyboard navigation ---
  const [kbNavState, kbNavActions] = useKeyboardNavigation(
    boardTasks,
    tasks,
    {
      onOpenDetail: handleCardClick,
      onMoveTask: performKeyboardMove,
    },
  );

  // Attach keyboard handler to the board container
  useEffect(() => {
    const container = boardContainerRef.current;
    if (!container) return;

    const handler = (e: KeyboardEvent) => {
      // Skip if the target is an input/textarea/select (let native handling work)
      const target = e.target as HTMLElement;
      const tagName = target.tagName.toLowerCase();
      if (tagName === "input" || tagName === "textarea" || tagName === "select") return;

      kbNavActions.handleKeyDown(e);
    };

    container.addEventListener("keydown", handler);
    return () => container.removeEventListener("keydown", handler);
  }, [kbNavActions]);

  // Configure sensors: pointer (mouse/touch) + keyboard for accessibility
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 5 },
  });
  const keyboardSensor = useSensor(KeyboardSensor);
  const sensors = useSensors(pointerSensor, keyboardSensor);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    if (isDraggingRef.current) return;
    isDraggingRef.current = true;
    perfMonitor.mark("dnd-feedback");

    const { taskWithPath, column } = event.active.data.current as {
      taskWithPath: TaskWithPath;
      column: BoardColumn;
    };
    setActiveTask(taskWithPath);
    setActiveColumn(column);
  }, []);

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { over } = event;
      if (!over || !activeTask || !activeColumn || !tasks) {
        setOverColumn(null);
        setOverTransition(null);
        return;
      }

      const targetColumn = over.data.current?.column as
        | BoardColumn
        | undefined;
      if (!targetColumn) {
        setOverColumn(null);
        setOverTransition(null);
        return;
      }

      setOverColumn(targetColumn);

      const result = validateTransition(
        activeTask,
        activeColumn,
        targetColumn,
        tasks,
      );
      setOverTransition(result);
    },
    [activeTask, activeColumn, tasks],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      isDraggingRef.current = false;
      const { over } = event;

      // Reset drag visual state
      setActiveTask(null);
      setActiveColumn(null);
      setOverColumn(null);
      setOverTransition(null);

      if (!over || !tasks) return;

      const dragData = event.active.data.current as {
        taskWithPath: TaskWithPath;
        column: BoardColumn;
      };
      const targetColumn = over.data.current?.column as
        | BoardColumn
        | undefined;
      if (!targetColumn || !dragData) return;

      const fromColumn = dragData.column;
      const taskWithPath = dragData.taskWithPath;
      const taskId = String(taskWithPath.task.id);

      // Same column = no-op
      if (fromColumn === targetColumn) return;

      // Validate the transition
      const result = validateTransition(
        taskWithPath,
        fromColumn,
        targetColumn,
        tasks,
      );

      // Invalid transition = no-op (visual feedback was shown during drag)
      if (!result.allowed) return;

      // Valid transition: determine target filesystem status
      const newStatus = COLUMN_TO_STATUS[targetColumn];
      if (!newStatus) return;

      // If task is already locked (write in flight), skip this drag
      if (isTaskLocked(taskId)) return;

      // Optimistic update: move card immediately in the store
      moveTaskOptimistic(taskWithPath, newStatus as TaskStatus);
      perfMonitor.measure("dnd-feedback", { taskId, from: fromColumn, to: targetColumn });

      // Async IPC write with timeout
      void (async () => {
        try {
          const writeResult = await withIpcTimeout(
            moveTask(taskWithPath.filePath, newStatus, taskWithPath.mtimeMs),
            IPC_TIMEOUT_MS,
          );

          // Confirm with real data from IPC response
          const updatedTask: TaskWithPath = {
            task: {
              ...taskWithPath.task,
              status: newStatus as TaskStatus,
            },
            filePath: writeResult.filePath,
            mtimeMs: writeResult.mtimeMs,
          };

          confirmMove(taskId, updatedTask);
          announce(`Task ${taskWithPath.task.title} moved to ${COLUMN_LABELS[targetColumn]}`);
        } catch (err) {
          // Rollback with animation
          setRollingBackTaskIds((prev) => {
            const next = new Set(prev);
            next.add(taskId);
            return next;
          });

          rollbackMove(taskId);

          // Show error toast with details
          const classified = err instanceof IpcError ? err : classifyIpcError(err);
          addToast(taskWithPath.task.title, classified.message);
          announce(`Failed to move task ${taskWithPath.task.title}`, "assertive");

          // Remove rollback animation after 600ms
          setTimeout(() => {
            setRollingBackTaskIds((prev) => {
              const next = new Set(prev);
              next.delete(taskId);
              return next;
            });
          }, 600);
        }
      })();
    },
    [tasks, moveTaskOptimistic, confirmMove, rollbackMove, isTaskLocked, addToast, announce],
  );

  const handleDragCancel = useCallback(() => {
    isDraggingRef.current = false;
    setActiveTask(null);
    setActiveColumn(null);
    setOverColumn(null);
    setOverTransition(null);
  }, []);

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (!tasks || isEmptyTaskList(tasks)) {
    return <EmptyState />;
  }

  if (!boardTasks) {
    return <EmptyState />;
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex h-full flex-col">
        {/* Board filter bar */}
        <BoardFilterBar
          activeGroups={activeTaskGroups}
          availableGroups={availableGroups}
          onToggleGroup={toggleTaskGroup}
          onClearFilter={handleClearFilter}
        />

        {/* Board area with horizontal scrolling */}
        <div
          ref={boardContainerRef}
          className="flex flex-1 gap-3 overflow-x-auto p-4"
          tabIndex={0}
          role="grid"
          aria-label="Kanban board"
          data-testid="kanban-board-grid"
        >
          {BOARD_COLUMNS.map((column, colIdx) => (
            <KanbanColumn
              key={column}
              column={column}
              tasks={boardTasks[column]}
              onCardClick={handleCardClick}
              isOver={overColumn === column}
              transitionResult={
                overColumn === column ? overTransition : null
              }
              lockedTaskIds={lockedTaskIds}
              rollingBackTaskIds={rollingBackTaskIds}
              keyboardFocusedCardIndex={
                kbNavState.isActive && kbNavState.focusedColumnIndex === colIdx
                  ? kbNavState.focusedCardIndex
                  : -1
              }
              keyboardDndState={kbNavState.dndState}
            />
          ))}
        </div>

        {/* Keyboard DnD mode status bar */}
        {kbNavState.dndState && (
          <div
            className="flex items-center gap-3 border-t border-purple-200 bg-purple-50 px-4 py-2 dark:border-purple-800 dark:bg-purple-900/30"
            data-testid="keyboard-dnd-status"
            role="status"
            aria-live="polite"
          >
            <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
              Moving: {kbNavState.dndState.task.task.title}
            </span>
            <span className="text-xs text-purple-600 dark:text-purple-400">
              Use Left/Right arrows to select column, Enter to drop, Escape to cancel
            </span>
          </div>
        )}

        {/* Unknown tasks warning section */}
        {boardTasks.unknown.length > 0 && (
          <div className="px-4 pb-4">
            <UnknownTasksSection tasks={boardTasks.unknown} />
          </div>
        )}

        {/* Task detail slide-out panel (lazy loaded) */}
        <ErrorBoundary sectionName="Task Detail" onError={(err) => {
          addToastGlobal("error", "Task Detail error", err.message);
        }}>
          <Suspense fallback={null}>
            <LazyTaskDetailPanel
              task={selectedTask}
              allTasks={tasks}
              onClose={handleClosePanel}
              onTaskNavigate={handleTaskNavigate}
              onTaskUpdated={handleTaskUpdated}
              onViewSpec={handleViewSpec}
            />
          </Suspense>
        </ErrorBoundary>

        {/* Spec viewer panel (lazy loaded, opened from task source_section link) */}
        {specViewerState && (
          <ErrorBoundary sectionName="Spec Viewer" onError={(err) => {
            addToastGlobal("error", "Spec Viewer error", err.message);
          }}>
            <Suspense fallback={
              <div className="flex items-center justify-center p-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
              </div>
            }>
              <LazySpecViewerPanel
                projectPath={projectPath}
                specPath={specViewerState.specPath}
                scrollToSection={specViewerState.scrollToSection}
                onBack={handleCloseSpecViewer}
                sourceTaskTitle={selectedTask?.task.title}
              />
            </Suspense>
          </ErrorBoundary>
        )}
      </div>

      {/* Drag overlay - card preview that follows the cursor */}
      <DragOverlay dropAnimation={null}>
        {activeTask ? <DragOverlayCard taskWithPath={activeTask} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

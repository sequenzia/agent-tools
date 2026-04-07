import type { TaskStatus } from "../types";
import type { BoardColumn } from "./KanbanBoard";

/**
 * SVG status icons for board columns and task status.
 * These provide a non-color visual indicator alongside colored badges,
 * ensuring WCAG 2.1 AA compliance (don't rely on color alone).
 */

interface StatusIconProps {
  /** Size in pixels (width and height). Defaults to 14. */
  size?: number;
  /** Additional CSS class names. */
  className?: string;
}

/** Circle outline - represents backlog/unstarted */
export function BacklogIcon({ size = 14, className = "" }: StatusIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/** Clock icon - represents pending/waiting */
export function PendingIcon({ size = 14, className = "" }: StatusIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 4.5V8L10.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Lock icon - represents blocked */
export function BlockedIcon({ size = 14, className = "" }: StatusIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.5 7V5C5.5 3.62 6.62 2.5 8 2.5C9.38 2.5 10.5 3.62 10.5 5V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Spinner/arrow-circle icon - represents in progress */
export function InProgressIcon({ size = 14, className = "" }: StatusIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path d="M13.5 8A5.5 5.5 0 1 1 8 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8 2.5L10.5 2.5L8 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** X-circle icon - represents failed */
export function FailedIcon({ size = 14, className = "" }: StatusIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.5 5.5L10.5 10.5M10.5 5.5L5.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Checkmark circle icon - represents completed */
export function CompletedIcon({ size = 14, className = "" }: StatusIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 8L7 10.5L11 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Map from board column to its status icon component. */
export const COLUMN_ICONS: Record<BoardColumn, React.FC<StatusIconProps>> = {
  backlog: BacklogIcon,
  pending: PendingIcon,
  blocked: BlockedIcon,
  in_progress: InProgressIcon,
  failed: FailedIcon,
  completed: CompletedIcon,
};

/** Map from task status to its icon component. */
export const STATUS_ICONS: Record<TaskStatus, React.FC<StatusIconProps>> = {
  backlog: BacklogIcon,
  pending: PendingIcon,
  in_progress: InProgressIcon,
  completed: CompletedIcon,
};

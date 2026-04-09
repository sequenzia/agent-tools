import { useState, useCallback } from "react";
import {
  useProjectStore,
  getDisplayName,
  type ProjectEntry,
  type TaskGroupInfo,
} from "../stores/project-store";

// --- Count Badge ---

function CountBadge({
  count,
  variant,
}: {
  count: number;
  variant: "pending" | "in_progress" | "completed";
}) {
  const colors = {
    pending:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
    in_progress:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    completed:
      "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  };

  if (count === 0) return null;

  const label = variant.replace("_", " ");
  return (
    <span
      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none ${colors[variant]}`}
      title={label}
      aria-label={`${count} ${label}`}
    >
      {count}
    </span>
  );
}

// --- Task Group Item ---

function TaskGroupItem({
  group,
  isActive,
  onClick,
}: {
  group: TaskGroupInfo;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs transition-colors ${
        isActive
          ? "bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200"
          : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/50"
      }`}
      onClick={onClick}
      data-testid={`task-group-${group.name}`}
      aria-pressed={isActive}
      aria-label={`Task group: ${group.name}`}
    >
      <span className="truncate flex-1">{group.name}</span>
      <div className="flex shrink-0 items-center gap-0.5">
        <CountBadge count={group.counts.pending} variant="pending" />
        <CountBadge count={group.counts.in_progress} variant="in_progress" />
        <CountBadge count={group.counts.completed} variant="completed" />
      </div>
    </button>
  );
}

// --- Disconnected Indicator ---

function DisconnectedIndicator({ onRemove }: { onRemove: () => void }) {
  return (
    <div className="mt-1 flex items-center gap-1.5 px-2">
      <span className="text-[10px] text-red-500 dark:text-red-400">
        disconnected
      </span>
      <button
        type="button"
        className="text-[10px] text-red-400 underline hover:text-red-600 dark:text-red-500 dark:hover:text-red-300"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        data-testid="remove-project-btn"
      >
        remove
      </button>
    </div>
  );
}

// --- Project Item ---

function ProjectItem({
  project,
  allProjects,
  isActive,
  activeTaskGroups,
  onSelectProject,
  onToggleTaskGroup,
  onRemove,
}: {
  project: ProjectEntry;
  allProjects: ProjectEntry[];
  isActive: boolean;
  activeTaskGroups: Set<string>;
  onSelectProject: (path: string) => void;
  onToggleTaskGroup: (group: string) => void;
  onRemove: (path: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(isActive);
  const displayName = getDisplayName(project, allProjects);

  const handleClick = useCallback(() => {
    onSelectProject(project.path);
    if (!isActive) {
      setIsExpanded(true);
    }
  }, [project.path, isActive, onSelectProject]);

  const handleToggleExpand = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isActive) {
        setIsExpanded((prev) => !prev);
      }
    },
    [isActive],
  );

  const handleGroupClick = useCallback(
    (groupName: string) => {
      if (!isActive) {
        onSelectProject(project.path);
      }
      onToggleTaskGroup(groupName);
    },
    [isActive, project.path, onSelectProject, onToggleTaskGroup],
  );

  const showExpanded = isActive && isExpanded;

  return (
    <div
      className={`rounded-lg transition-colors ${
        isActive
          ? "bg-blue-50 ring-1 ring-blue-500/20 dark:bg-blue-900/30 dark:ring-blue-400/20"
          : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
      }`}
      data-testid={`project-${project.name}`}
    >
      {/* Project header */}
      <button
        type="button"
        className="flex w-full items-start gap-2 rounded-lg px-4 py-2 text-left"
        onClick={handleClick}
        data-testid={`project-btn-${project.name}`}
        aria-label={`Select project: ${displayName}${!project.connected ? " (disconnected)" : ""}`}
        aria-current={isActive ? "true" : undefined}
        aria-expanded={project.taskGroups.length > 0 ? showExpanded : undefined}
      >
        {/* Expand/collapse arrow */}
        {project.taskGroups.length > 0 && (
          <span
            className="mt-0.5 shrink-0 text-gray-400 dark:text-gray-500 cursor-pointer select-none rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            onClick={handleToggleExpand}
            data-testid={`expand-toggle-${project.name}`}
            role="button"
            tabIndex={-1}
            aria-label={showExpanded ? "Collapse task groups" : "Expand task groups"}
          >
            {showExpanded ? "\u25BC" : "\u25B6"}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className={`text-sm font-medium truncate ${
                isActive
                  ? "text-blue-900 dark:text-blue-200"
                  : "text-gray-900 dark:text-gray-100"
              } ${!project.connected ? "line-through opacity-60" : ""}`}
            >
              {displayName}
            </span>
          </div>

          {/* Task count summary badges */}
          {project.connected && project.counts.total > 0 && (
            <div className="mt-1 flex items-center gap-1">
              <CountBadge
                count={project.counts.pending}
                variant="pending"
              />
              <CountBadge
                count={project.counts.in_progress}
                variant="in_progress"
              />
              <CountBadge
                count={project.counts.completed}
                variant="completed"
              />
            </div>
          )}

          {!project.connected && (
            <DisconnectedIndicator
              onRemove={() => onRemove(project.path)}
            />
          )}
        </div>
      </button>

      {/* Expandable task groups */}
      {showExpanded && project.taskGroups.length > 0 && (
        <div className="px-4 pb-2 pl-8" data-testid={`groups-${project.name}`}>
          <div className="space-y-0.5">
            {project.taskGroups.map((group) => (
              <TaskGroupItem
                key={group.name}
                group={group}
                isActive={isActive && activeTaskGroups.has(group.name)}
                onClick={() => handleGroupClick(group.name)}
              />
            ))}
          </div>
        </div>
      )}

      {/* No tasks indicator */}
      {showExpanded &&
        project.connected &&
        project.taskGroups.length === 0 &&
        project.counts.total === 0 && (
          <div className="px-4 pb-2 pl-8">
            <p
              className="text-xs text-gray-400 dark:text-gray-500 italic"
              data-testid={`no-tasks-${project.name}`}
            >
              No tasks found
            </p>
          </div>
        )}
    </div>
  );
}

// --- Add Project Button ---

function AddProjectButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2.5 text-sm text-gray-500 transition-all hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 dark:border-gray-600 dark:text-gray-400 dark:hover:border-blue-500 dark:hover:text-blue-400 dark:hover:bg-blue-950/30"
      onClick={onClick}
      data-testid="add-project-btn"
    >
      <span className="text-lg leading-none">+</span>
      <span>Add Project</span>
    </button>
  );
}

// --- Main Sidebar Component ---

// --- Chevron Icons ---

function ChevronLeftIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}

export interface ProjectSidebarProps {
  /** Callback when the user clicks "Add Project". */
  onAddProject: () => void;
  /** Whether the sidebar is collapsed (for narrow windows). */
  collapsed?: boolean;
  /** Callback when the user clicks "Settings". */
  onOpenSettings?: () => void;
  /** Callback to toggle sidebar collapsed state. */
  onToggleCollapse?: () => void;
}

export function ProjectSidebar({
  onAddProject,
  collapsed = false,
  onOpenSettings,
  onToggleCollapse,
}: ProjectSidebarProps) {
  const {
    projects,
    activeProjectPath,
    activeTaskGroups,
    setActiveProject,
    toggleTaskGroup,
    removeProject,
  } = useProjectStore();

  const iconBtnClass =
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-400 dark:hover:bg-gray-800";

  const settingsIcon = (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );

  return (
    <aside
      className={`flex shrink-0 flex-col border-r border-gray-200 bg-white overflow-hidden transition-[width] duration-300 ease-in-out dark:border-gray-700/50 dark:bg-gradient-to-b dark:from-gray-900 dark:to-gray-950 ${
        collapsed ? "w-12 items-center" : "w-64"
      }`}
      data-testid={collapsed ? "sidebar-collapsed" : "sidebar"}
      role="navigation"
      aria-label={`Project navigation${collapsed ? " (collapsed)" : ""}`}
    >
      {collapsed ? (
        /* ── Collapsed layout ── */
        <div className="flex flex-1 flex-col items-center py-4">
          {onToggleCollapse && (
            <button
              type="button"
              className={iconBtnClass}
              onClick={onToggleCollapse}
              title="Expand sidebar"
              aria-label="Expand sidebar"
              data-testid="sidebar-expand-btn"
            >
              <ChevronRightIcon />
            </button>
          )}
          <button
            type="button"
            className={`${iconBtnClass} mt-2`}
            onClick={onAddProject}
            title="Add Project"
            aria-label="Add project"
            data-testid="add-project-btn-collapsed"
          >
            +
          </button>
          {projects.map((project) => {
            const counts = project.counts;
            const tooltip = project.connected
              ? `${project.name}\n${counts.pending} pending, ${counts.in_progress} in progress, ${counts.completed} completed`
              : `${project.name} (disconnected)`;
            return (
              <div key={project.path} className="relative mt-2">
                <button
                  type="button"
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    activeProjectPath === project.path
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                      : `text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 ${!project.connected ? "opacity-50" : ""}`
                  }`}
                  onClick={() => setActiveProject(project.path)}
                  title={tooltip}
                  aria-label={`Select project: ${project.name}${!project.connected ? " (disconnected)" : ""}`}
                  aria-current={activeProjectPath === project.path ? "true" : undefined}
                >
                  {project.name.charAt(0).toUpperCase()}
                </button>
                {project.connected && counts.total > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-0.5 text-[9px] font-bold text-white dark:bg-blue-400 dark:text-gray-900">
                    {counts.total > 99 ? "99+" : counts.total}
                  </span>
                )}
              </div>
            );
          })}
          {onOpenSettings && (
            <button
              type="button"
              className={`mt-auto ${iconBtnClass}`}
              onClick={onOpenSettings}
              title="Settings"
              aria-label="Open settings"
              data-testid="settings-btn-collapsed"
            >
              {settingsIcon}
            </button>
          )}
        </div>
      ) : (
        /* ── Expanded layout ── */
        <>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700/50 dark:bg-gray-800/30">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
              Projects
            </h2>
            <div className="flex items-center gap-1.5">
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                {projects.length}
              </span>
              {onToggleCollapse && (
                <button
                  type="button"
                  className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                  onClick={onToggleCollapse}
                  title="Collapse sidebar"
                  aria-label="Collapse sidebar"
                  data-testid="sidebar-collapse-btn"
                >
                  <ChevronLeftIcon />
                </button>
              )}
            </div>
          </div>

          {/* Project list - scrollable */}
          <div className="flex-1 overflow-y-auto px-2 py-2">
            {projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <p className="mb-3 text-center text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                  No projects configured
                </p>
                <AddProjectButton onClick={onAddProject} />
              </div>
            ) : (
              <div className="space-y-1">
                {projects.map((project) => (
                  <ProjectItem
                    key={project.path}
                    project={project}
                    allProjects={projects}
                    isActive={activeProjectPath === project.path}
                    activeTaskGroups={activeTaskGroups}
                    onSelectProject={setActiveProject}
                    onToggleTaskGroup={toggleTaskGroup}
                    onRemove={removeProject}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer with Add Project button and Settings */}
          <div className="border-t border-gray-200 px-4 py-3 dark:border-gray-700">
            {projects.length > 0 && <AddProjectButton onClick={onAddProject} />}
            {onOpenSettings && (
              <button
                type="button"
                className="mt-2 flex w-full items-center gap-2 rounded-lg px-4 py-2 text-sm text-gray-600 whitespace-nowrap transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-400 dark:hover:bg-gray-700"
                onClick={onOpenSettings}
                title="Settings"
                data-testid="settings-btn"
                aria-label="Open settings"
              >
                {settingsIcon}
                <span>Settings</span>
              </button>
            )}
          </div>
        </>
      )}
    </aside>
  );
}

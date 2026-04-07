import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import {
  TaskCard,
  TaskCardContent,
  PriorityBadge,
  ComplexityBadge,
} from "../TaskCard";
import type { TaskWithPath } from "../../services/task-service";

afterEach(() => {
  cleanup();
});

// --- Test helpers ---

function makeTaskWithPath(
  id: number | string,
  title: string,
  status: string,
  extra?: {
    description?: string;
    metadata?: Record<string, unknown>;
    blocked_by?: (number | string)[];
  },
): TaskWithPath {
  return {
    task: {
      id,
      title,
      description: extra?.description ?? `Description for ${title}`,
      status: status as "backlog" | "pending" | "in_progress" | "completed",
      metadata: extra?.metadata,
      blocked_by: extra?.blocked_by,
    },
    filePath: `/project/.agents/tasks/${status}/group/task-${id}.json`,
    mtimeMs: 1700000000000,
  };
}

// --- PriorityBadge tests ---

describe("PriorityBadge", () => {
  it("renders critical priority with red color classes", () => {
    render(<PriorityBadge priority="critical" />);
    const badge = screen.getByTestId("priority-badge");
    expect(badge.textContent).toBe("critical");
    expect(badge.className).toContain("bg-red-100");
    expect(badge.className).toContain("text-red-800");
  });

  it("renders high priority with orange color classes", () => {
    render(<PriorityBadge priority="high" />);
    const badge = screen.getByTestId("priority-badge");
    expect(badge.textContent).toBe("high");
    expect(badge.className).toContain("bg-orange-100");
    expect(badge.className).toContain("text-orange-800");
  });

  it("renders medium priority with blue color classes", () => {
    render(<PriorityBadge priority="medium" />);
    const badge = screen.getByTestId("priority-badge");
    expect(badge.textContent).toBe("medium");
    expect(badge.className).toContain("bg-blue-100");
    expect(badge.className).toContain("text-blue-800");
  });

  it("renders low priority with gray color classes", () => {
    render(<PriorityBadge priority="low" />);
    const badge = screen.getByTestId("priority-badge");
    expect(badge.textContent).toBe("low");
    expect(badge.className).toContain("bg-gray-100");
    expect(badge.className).toContain("text-gray-600");
  });

  it("falls back to medium (blue) styling for unknown priority", () => {
    render(<PriorityBadge priority="urgent" />);
    const badge = screen.getByTestId("priority-badge");
    expect(badge.textContent).toBe("urgent");
    expect(badge.className).toContain("bg-blue-100");
    expect(badge.className).toContain("text-blue-800");
  });
});

// --- ComplexityBadge tests ---

describe("ComplexityBadge", () => {
  it.each([
    ["XS", "bg-emerald-100"],
    ["S", "bg-teal-100"],
    ["M", "bg-sky-100"],
    ["L", "bg-violet-100"],
    ["XL", "bg-fuchsia-100"],
  ])("renders %s complexity with correct color", (complexity, expectedClass) => {
    render(<ComplexityBadge complexity={complexity} />);
    const badge = screen.getByTestId("complexity-badge");
    expect(badge.textContent).toBe(complexity);
    expect(badge.className).toContain(expectedClass);
  });

  it("falls back to M (sky) styling for unknown complexity", () => {
    render(<ComplexityBadge complexity="XXL" />);
    const badge = screen.getByTestId("complexity-badge");
    expect(badge.textContent).toBe("XXL");
    expect(badge.className).toContain("bg-sky-100");
  });
});

// --- TaskCardContent tests ---

describe("TaskCardContent", () => {
  it("displays task title and ID", () => {
    const twp = makeTaskWithPath(42, "Implement auth", "pending");
    render(<TaskCardContent taskWithPath={twp} />);

    expect(screen.getByText("Implement auth")).toBeDefined();
    expect(screen.getByText("#42")).toBeDefined();
  });

  it("displays priority badge when metadata has priority", () => {
    const twp = makeTaskWithPath(1, "Task", "pending", {
      metadata: { priority: "high" },
    });
    render(<TaskCardContent taskWithPath={twp} />);

    const badge = screen.getByTestId("priority-badge");
    expect(badge.textContent).toBe("high");
    expect(badge.className).toContain("bg-orange-100");
  });

  it("displays complexity badge when metadata has complexity", () => {
    const twp = makeTaskWithPath(1, "Task", "pending", {
      metadata: { complexity: "L" },
    });
    render(<TaskCardContent taskWithPath={twp} />);

    const badge = screen.getByTestId("complexity-badge");
    expect(badge.textContent).toBe("L");
    expect(badge.className).toContain("bg-violet-100");
  });

  it("displays task group label", () => {
    const twp = makeTaskWithPath(1, "Task", "pending", {
      metadata: { task_group: "authentication" },
    });
    render(<TaskCardContent taskWithPath={twp} />);

    expect(screen.getByText("authentication")).toBeDefined();
  });

  it("displays dependency count when blocked_by has entries", () => {
    const twp = makeTaskWithPath(1, "Task", "pending", {
      blocked_by: [10, 11, 12],
    });
    render(<TaskCardContent taskWithPath={twp} />);

    const badge = screen.getByTestId("dependency-badge");
    expect(badge.textContent).toBe("3 deps");
  });

  it("displays singular 'dep' for single dependency", () => {
    const twp = makeTaskWithPath(1, "Task", "pending", {
      blocked_by: [10],
    });
    render(<TaskCardContent taskWithPath={twp} />);

    const badge = screen.getByTestId("dependency-badge");
    expect(badge.textContent).toBe("1 dep");
  });

  it("does not show dependency badge when blocked_by is empty", () => {
    const twp = makeTaskWithPath(1, "Task", "pending", {
      blocked_by: [],
    });
    render(<TaskCardContent taskWithPath={twp} />);

    expect(screen.queryByTestId("dependency-badge")).toBeNull();
  });

  it("does not show dependency badge when blocked_by is undefined", () => {
    const twp = makeTaskWithPath(1, "Task", "pending");
    render(<TaskCardContent taskWithPath={twp} />);

    expect(screen.queryByTestId("dependency-badge")).toBeNull();
  });

  it("has line-clamp-2 class for title truncation", () => {
    const twp = makeTaskWithPath(
      1,
      "This is a very long task title that should be truncated with ellipsis when it exceeds the available space in the card",
      "pending",
    );
    render(<TaskCardContent taskWithPath={twp} />);

    const title = screen.getByText(/This is a very long task title/);
    expect(title.className).toContain("line-clamp-2");
  });

  it("sets title attribute on heading for full title tooltip", () => {
    const fullTitle = "A very long task title for tooltip";
    const twp = makeTaskWithPath(1, fullTitle, "pending");
    render(<TaskCardContent taskWithPath={twp} />);

    const heading = screen.getByText(fullTitle);
    expect(heading.getAttribute("title")).toBe(fullTitle);
  });

  it("renders without errors when metadata is undefined", () => {
    const twp = makeTaskWithPath(1, "Minimal task", "pending");
    render(<TaskCardContent taskWithPath={twp} />);

    expect(screen.getByText("Minimal task")).toBeDefined();
    expect(screen.queryByTestId("priority-badge")).toBeNull();
    expect(screen.queryByTestId("complexity-badge")).toBeNull();
    expect(screen.queryByTestId("dependency-badge")).toBeNull();
  });

  it("renders without errors when metadata has no priority or complexity", () => {
    const twp = makeTaskWithPath(1, "Partial metadata", "pending", {
      metadata: { task_group: "misc" },
    });
    render(<TaskCardContent taskWithPath={twp} />);

    expect(screen.getByText("Partial metadata")).toBeDefined();
    expect(screen.getByText("misc")).toBeDefined();
    expect(screen.queryByTestId("priority-badge")).toBeNull();
    expect(screen.queryByTestId("complexity-badge")).toBeNull();
  });

  it("displays all badges together", () => {
    const twp = makeTaskWithPath(1, "Full card", "pending", {
      metadata: {
        priority: "critical",
        complexity: "XL",
        task_group: "payments",
      },
      blocked_by: [5, 6],
    });
    render(<TaskCardContent taskWithPath={twp} />);

    expect(screen.getByText("Full card")).toBeDefined();
    expect(screen.getByText("payments")).toBeDefined();
    expect(screen.getByTestId("priority-badge").textContent).toBe("critical");
    expect(screen.getByTestId("complexity-badge").textContent).toBe("XL");
    expect(screen.getByTestId("dependency-badge").textContent).toBe("2 deps");
  });
});

// --- TaskCard (interactive) tests ---

describe("TaskCard", () => {
  it("triggers onClick callback when clicked", () => {
    const onClick = vi.fn();
    const twp = makeTaskWithPath(1, "Clickable task", "pending");

    render(<TaskCard taskWithPath={twp} onClick={onClick} />);

    fireEvent.click(screen.getByTestId("task-card-1"));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledWith(twp);
  });

  it("triggers onClick on Enter keypress", () => {
    const onClick = vi.fn();
    const twp = makeTaskWithPath(1, "Keyboard task", "pending");

    render(<TaskCard taskWithPath={twp} onClick={onClick} />);

    fireEvent.keyDown(screen.getByTestId("task-card-1"), { key: "Enter" });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("triggers onClick on Space keypress", () => {
    const onClick = vi.fn();
    const twp = makeTaskWithPath(1, "Space task", "pending");

    render(<TaskCard taskWithPath={twp} onClick={onClick} />);

    fireEvent.keyDown(screen.getByTestId("task-card-1"), { key: " " });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("has correct data-testid", () => {
    const onClick = vi.fn();
    const twp = makeTaskWithPath(42, "Test card", "pending");

    render(<TaskCard taskWithPath={twp} onClick={onClick} />);

    expect(screen.getByTestId("task-card-42")).toBeDefined();
  });

  it("has role=button and tabIndex=0 for accessibility", () => {
    const onClick = vi.fn();
    const twp = makeTaskWithPath(1, "Accessible card", "pending");

    render(<TaskCard taskWithPath={twp} onClick={onClick} />);

    const card = screen.getByTestId("task-card-1");
    expect(card.getAttribute("role")).toBe("button");
    expect(card.getAttribute("tabindex")).toBe("0");
  });

  it("has aria-label with task title", () => {
    const onClick = vi.fn();
    const twp = makeTaskWithPath(1, "My task", "pending");

    render(<TaskCard taskWithPath={twp} onClick={onClick} />);

    const card = screen.getByTestId("task-card-1");
    expect(card.getAttribute("aria-label")).toBe("Task My task");
  });

  it("uses consistent card sizing with rounded-lg and p-3 classes", () => {
    const onClick = vi.fn();
    const twp = makeTaskWithPath(1, "Sized card", "pending");

    render(<TaskCard taskWithPath={twp} onClick={onClick} />);

    const card = screen.getByTestId("task-card-1");
    expect(card.className).toContain("rounded-lg");
    expect(card.className).toContain("p-3");
  });

  it("applies additional className when provided", () => {
    const onClick = vi.fn();
    const twp = makeTaskWithPath(1, "Custom class", "pending");

    render(
      <TaskCard
        taskWithPath={twp}
        onClick={onClick}
        className="cursor-grab"
      />,
    );

    const card = screen.getByTestId("task-card-1");
    expect(card.className).toContain("cursor-grab");
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import {
  PriorityEditor,
  ComplexityEditor,
  BlockedByEditor,
  AcceptanceCriteriaEditor,
  FieldEditorWrapper,
} from "../InlineFieldEditor";
import type { TasksByStatus } from "../../services/task-service";

// Mock api-client
vi.mock("../../services/api-client", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  ws: { on: vi.fn(() => vi.fn()), send: vi.fn(), connected: vi.fn(() => true), close: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function makeAllTasks(
  tasks: Array<{ id: number; title: string; status: string }> = [],
): TasksByStatus {
  const result: TasksByStatus = {
    backlog: [],
    pending: [],
    in_progress: [],
    completed: [],
    errors: [],
  };
  for (const t of tasks) {
    const status = t.status as keyof Omit<TasksByStatus, "errors">;
    result[status].push({
      task: {
        id: t.id,
        title: t.title,
        description: "",
        status: t.status as "pending",
      },
      filePath: `/path/task-${t.id}.json`,
      mtimeMs: 1700000000000,
    });
  }
  return result;
}

describe("FieldEditorWrapper", () => {
  it("renders save and cancel buttons", () => {
    render(
      <FieldEditorWrapper
        label="Test"
        isSaving={false}
        error={null}
        warning={null}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      >
        <div>Content</div>
      </FieldEditorWrapper>,
    );

    expect(screen.getByTestId("field-save-button")).toBeDefined();
    expect(screen.getByTestId("field-cancel-button")).toBeDefined();
  });

  it("shows error message", () => {
    render(
      <FieldEditorWrapper
        label="Test"
        isSaving={false}
        error="Something went wrong"
        warning={null}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      >
        <div>Content</div>
      </FieldEditorWrapper>,
    );

    expect(screen.getByTestId("field-error").textContent).toBe(
      "Something went wrong",
    );
  });

  it("shows warning message when no error", () => {
    render(
      <FieldEditorWrapper
        label="Test"
        isSaving={false}
        error={null}
        warning="Be careful"
        onSave={vi.fn()}
        onCancel={vi.fn()}
      >
        <div>Content</div>
      </FieldEditorWrapper>,
    );

    expect(screen.getByTestId("field-warning").textContent).toBe(
      "Be careful",
    );
  });

  it("hides warning when error is present", () => {
    render(
      <FieldEditorWrapper
        label="Test"
        isSaving={false}
        error="Error"
        warning="Warning"
        onSave={vi.fn()}
        onCancel={vi.fn()}
      >
        <div>Content</div>
      </FieldEditorWrapper>,
    );

    expect(screen.getByTestId("field-error")).toBeDefined();
    expect(screen.queryByTestId("field-warning")).toBeNull();
  });

  it("disables buttons while saving", () => {
    render(
      <FieldEditorWrapper
        label="Test"
        isSaving={true}
        error={null}
        warning={null}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      >
        <div>Content</div>
      </FieldEditorWrapper>,
    );

    const saveBtn = screen.getByTestId("field-save-button") as HTMLButtonElement;
    const cancelBtn = screen.getByTestId("field-cancel-button") as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
    expect(cancelBtn.disabled).toBe(true);
    expect(saveBtn.textContent).toBe("Saving...");
  });

  it("calls onSave when save button clicked", () => {
    const onSave = vi.fn();
    render(
      <FieldEditorWrapper
        label="Test"
        isSaving={false}
        error={null}
        warning={null}
        onSave={onSave}
        onCancel={vi.fn()}
      >
        <div>Content</div>
      </FieldEditorWrapper>,
    );

    fireEvent.click(screen.getByTestId("field-save-button"));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when cancel button clicked", () => {
    const onCancel = vi.fn();
    render(
      <FieldEditorWrapper
        label="Test"
        isSaving={false}
        error={null}
        warning={null}
        onSave={vi.fn()}
        onCancel={onCancel}
      >
        <div>Content</div>
      </FieldEditorWrapper>,
    );

    fireEvent.click(screen.getByTestId("field-cancel-button"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe("PriorityEditor", () => {
  it("renders dropdown with all priority options", () => {
    render(<PriorityEditor value="medium" onChange={vi.fn()} />);
    const select = screen.getByTestId("priority-select") as HTMLSelectElement;
    expect(select.value).toBe("medium");

    // Should have 4 priority options + 1 empty option
    const options = select.querySelectorAll("option");
    expect(options.length).toBe(5);
  });

  it("calls onChange with selected priority", () => {
    const onChange = vi.fn();
    render(<PriorityEditor value="medium" onChange={onChange} />);

    fireEvent.change(screen.getByTestId("priority-select"), {
      target: { value: "critical" },
    });

    expect(onChange).toHaveBeenCalledWith("critical");
  });

  it("calls onChange with undefined when empty option selected", () => {
    const onChange = vi.fn();
    render(<PriorityEditor value="medium" onChange={onChange} />);

    fireEvent.change(screen.getByTestId("priority-select"), {
      target: { value: "" },
    });

    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it("handles undefined initial value", () => {
    render(<PriorityEditor value={undefined} onChange={vi.fn()} />);
    const select = screen.getByTestId("priority-select") as HTMLSelectElement;
    expect(select.value).toBe("");
  });
});

describe("ComplexityEditor", () => {
  it("renders dropdown with all complexity options", () => {
    render(<ComplexityEditor value="M" onChange={vi.fn()} />);
    const select = screen.getByTestId("complexity-select") as HTMLSelectElement;
    expect(select.value).toBe("M");

    const options = select.querySelectorAll("option");
    expect(options.length).toBe(6); // 5 + empty
  });

  it("calls onChange with selected complexity", () => {
    const onChange = vi.fn();
    render(<ComplexityEditor value="M" onChange={onChange} />);

    fireEvent.change(screen.getByTestId("complexity-select"), {
      target: { value: "XL" },
    });

    expect(onChange).toHaveBeenCalledWith("XL");
  });

  it("calls onChange with undefined when empty option selected", () => {
    const onChange = vi.fn();
    render(<ComplexityEditor value="M" onChange={onChange} />);

    fireEvent.change(screen.getByTestId("complexity-select"), {
      target: { value: "" },
    });

    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});

describe("BlockedByEditor", () => {
  const tasks = [
    { id: 1, title: "Current Task", status: "pending" },
    { id: 2, title: "Setup DB", status: "pending" },
    { id: 3, title: "Auth Module", status: "in_progress" },
    { id: 4, title: "Deploy Script", status: "completed" },
  ];

  it("renders search input", () => {
    render(
      <BlockedByEditor
        value={[]}
        onChange={vi.fn()}
        allTasks={makeAllTasks(tasks)}
        currentTaskId={1}
      />,
    );

    expect(screen.getByTestId("blocked-by-search")).toBeDefined();
  });

  it("shows dropdown on search focus", () => {
    render(
      <BlockedByEditor
        value={[]}
        onChange={vi.fn()}
        allTasks={makeAllTasks(tasks)}
        currentTaskId={1}
      />,
    );

    fireEvent.focus(screen.getByTestId("blocked-by-search"));
    expect(screen.getByTestId("blocked-by-dropdown")).toBeDefined();
  });

  it("excludes current task from dropdown", () => {
    render(
      <BlockedByEditor
        value={[]}
        onChange={vi.fn()}
        allTasks={makeAllTasks(tasks)}
        currentTaskId={1}
      />,
    );

    fireEvent.focus(screen.getByTestId("blocked-by-search"));

    // Should not show task #1 (self)
    expect(screen.queryByTestId("dep-option-1")).toBeNull();
    // Should show tasks #2, #3, #4
    expect(screen.getByTestId("dep-option-2")).toBeDefined();
    expect(screen.getByTestId("dep-option-3")).toBeDefined();
    expect(screen.getByTestId("dep-option-4")).toBeDefined();
  });

  it("filters tasks by search text", () => {
    render(
      <BlockedByEditor
        value={[]}
        onChange={vi.fn()}
        allTasks={makeAllTasks(tasks)}
        currentTaskId={1}
      />,
    );

    const search = screen.getByTestId("blocked-by-search");
    fireEvent.focus(search);
    fireEvent.change(search, { target: { value: "Auth" } });

    // Only Auth Module should match
    expect(screen.getByTestId("dep-option-3")).toBeDefined();
    expect(screen.queryByTestId("dep-option-2")).toBeNull();
    expect(screen.queryByTestId("dep-option-4")).toBeNull();
  });

  it("calls onChange when a task is toggled on", () => {
    const onChange = vi.fn();
    render(
      <BlockedByEditor
        value={[]}
        onChange={onChange}
        allTasks={makeAllTasks(tasks)}
        currentTaskId={1}
      />,
    );

    fireEvent.focus(screen.getByTestId("blocked-by-search"));
    fireEvent.click(screen.getByTestId("dep-option-2"));

    expect(onChange).toHaveBeenCalledWith(["2"]);
  });

  it("calls onChange when a task is toggled off", () => {
    const onChange = vi.fn();
    render(
      <BlockedByEditor
        value={["2", "3"]}
        onChange={onChange}
        allTasks={makeAllTasks(tasks)}
        currentTaskId={1}
      />,
    );

    fireEvent.focus(screen.getByTestId("blocked-by-search"));
    fireEvent.click(screen.getByTestId("dep-option-2"));

    expect(onChange).toHaveBeenCalledWith(["3"]);
  });

  it("renders selected items as chips", () => {
    render(
      <BlockedByEditor
        value={[2, 3]}
        onChange={vi.fn()}
        allTasks={makeAllTasks(tasks)}
        currentTaskId={1}
      />,
    );

    expect(screen.getByTestId("blocked-by-chips")).toBeDefined();
    expect(screen.getByTestId("remove-dep-2")).toBeDefined();
    expect(screen.getByTestId("remove-dep-3")).toBeDefined();
  });

  it("removes a chip when remove button clicked", () => {
    const onChange = vi.fn();
    render(
      <BlockedByEditor
        value={[2, 3]}
        onChange={onChange}
        allTasks={makeAllTasks(tasks)}
        currentTaskId={1}
      />,
    );

    fireEvent.click(screen.getByTestId("remove-dep-2"));
    expect(onChange).toHaveBeenCalledWith([3]);
  });
});

describe("AcceptanceCriteriaEditor", () => {
  it("renders text areas for all four categories", () => {
    const value = {
      functional: ["Criterion 1", "Criterion 2"],
      edge_cases: ["Edge 1"],
      error_handling: [],
      performance: [],
    };

    render(
      <AcceptanceCriteriaEditor value={value} onChange={vi.fn()} />,
    );

    expect(screen.getByTestId("ac-textarea-functional")).toBeDefined();
    expect(screen.getByTestId("ac-textarea-edge_cases")).toBeDefined();
    expect(screen.getByTestId("ac-textarea-error_handling")).toBeDefined();
    expect(screen.getByTestId("ac-textarea-performance")).toBeDefined();
  });

  it("displays existing criteria in text areas", () => {
    const value = {
      functional: ["Line 1", "Line 2"],
      edge_cases: [],
      error_handling: [],
      performance: [],
    };

    render(
      <AcceptanceCriteriaEditor value={value} onChange={vi.fn()} />,
    );

    const textarea = screen.getByTestId(
      "ac-textarea-functional",
    ) as HTMLTextAreaElement;
    expect(textarea.value).toBe("Line 1\nLine 2");
  });

  it("calls onChange when text area content changes", () => {
    const onChange = vi.fn();
    const value = {
      functional: ["Old criterion"],
      edge_cases: [],
      error_handling: [],
      performance: [],
    };

    render(
      <AcceptanceCriteriaEditor value={value} onChange={onChange} />,
    );

    fireEvent.change(screen.getByTestId("ac-textarea-functional"), {
      target: { value: "New criterion 1\nNew criterion 2" },
    });

    expect(onChange).toHaveBeenCalledWith({
      ...value,
      functional: ["New criterion 1", "New criterion 2"],
    });
  });

  it("filters out empty lines from criteria", () => {
    const onChange = vi.fn();
    const value = {
      functional: [],
      edge_cases: [],
      error_handling: [],
      performance: [],
    };

    render(
      <AcceptanceCriteriaEditor value={value} onChange={onChange} />,
    );

    fireEvent.change(screen.getByTestId("ac-textarea-functional"), {
      target: { value: "Line 1\n\n\nLine 2\n" },
    });

    expect(onChange).toHaveBeenCalledWith({
      ...value,
      functional: ["Line 1", "Line 2"],
    });
  });
});

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SessionTimeline } from "../SessionTimeline";
import type { SessionTimelineState } from "../../hooks/use-session-timeline";
import type {
  TimelineData,
  TimelineEvent,
  TimelineSummary,
} from "../../services/timeline-service";

afterEach(() => {
  cleanup();
});

// --- Test helpers ---

function makeSummary(overrides?: Partial<TimelineSummary>): TimelineSummary {
  return {
    tasksCompleted: 3,
    tasksPassed: 2,
    tasksFailed: 1,
    tasksRunning: 0,
    totalDurationSeconds: 160,
    totalDuration: "2m 40s",
    averageDurationSeconds: 53,
    averageDuration: "53s",
    ...overrides,
  };
}

function makeEvent(overrides?: Partial<TimelineEvent>): TimelineEvent {
  return {
    taskId: "101",
    title: "Scaffold project",
    type: "completed",
    duration: "45s",
    durationSeconds: 45,
    status: "PASS",
    attempts: "1/3",
    order: 0,
    isMalformed: false,
    ...overrides,
  };
}

function makeTimeline(overrides?: Partial<TimelineData>): TimelineData {
  return {
    events: [
      makeEvent({ taskId: "101", title: "Scaffold project", order: 0 }),
      makeEvent({
        taskId: "102",
        title: "Add data model",
        duration: "32s",
        durationSeconds: 32,
        order: 1,
      }),
      makeEvent({
        taskId: "103",
        title: "Setup testing",
        type: "failed",
        status: "FAIL",
        duration: "1m 23s",
        durationSeconds: 83,
        order: 2,
      }),
    ],
    summary: makeSummary(),
    parseError: null,
    malformedCount: 0,
    ...overrides,
  };
}

function makeState(
  overrides?: Partial<SessionTimelineState>,
): SessionTimelineState {
  return {
    timeline: makeTimeline(),
    isLoading: false,
    isActive: true,
    error: null,
    ...overrides,
  };
}

describe("SessionTimeline", () => {
  describe("when inactive", () => {
    it("renders nothing when isActive is false", () => {
      const { container } = render(
        <SessionTimeline state={makeState({ isActive: false })} />,
      );
      expect(container.innerHTML).toBe("");
    });
  });

  describe("placeholder state", () => {
    it("shows placeholder when timeline has no events", () => {
      render(
        <SessionTimeline
          state={makeState({
            timeline: makeTimeline({ events: [] }),
            isActive: true,
          })}
        />,
      );
      expect(screen.getByTestId("timeline-placeholder")).toBeDefined();
      expect(
        screen.getByText("Execution starting..."),
      ).toBeDefined();
    });

    it("shows placeholder when timeline is null", () => {
      render(
        <SessionTimeline
          state={makeState({ timeline: null, isActive: true })}
        />,
      );
      expect(screen.getByTestId("timeline-placeholder")).toBeDefined();
    });
  });

  describe("summary statistics", () => {
    it("displays total duration", () => {
      render(<SessionTimeline state={makeState()} />);
      expect(
        screen.getByTestId("summary-total-duration").textContent,
      ).toBe("2m 40s");
    });

    it("displays tasks completed count", () => {
      render(<SessionTimeline state={makeState()} />);
      expect(
        screen.getByTestId("summary-tasks-completed").textContent,
      ).toBe("3");
    });

    it("displays average duration", () => {
      render(<SessionTimeline state={makeState()} />);
      expect(
        screen.getByTestId("summary-avg-duration").textContent,
      ).toBe("53s");
    });

    it("displays pass/fail counts", () => {
      render(<SessionTimeline state={makeState()} />);
      expect(screen.getByTestId("summary-passed").textContent).toBe("2");
      expect(screen.getByTestId("summary-failed").textContent).toBe("1");
    });

    it("summary remains visible above scrollable event list", () => {
      render(<SessionTimeline state={makeState()} />);
      expect(
        screen.getByTestId("timeline-summary-section"),
      ).toBeDefined();
      const eventsContainer = screen.getByTestId("timeline-events");
      expect(eventsContainer.className).toContain("overflow-y-auto");
      expect(eventsContainer.className).toContain("max-h-96");
    });
  });

  describe("timeline events", () => {
    it("renders all events", () => {
      render(<SessionTimeline state={makeState()} />);
      expect(
        screen.getByTestId("timeline-event-101-completed"),
      ).toBeDefined();
      expect(
        screen.getByTestId("timeline-event-102-completed"),
      ).toBeDefined();
      expect(
        screen.getByTestId("timeline-event-103-failed"),
      ).toBeDefined();
    });

    it("shows task IDs in mono font", () => {
      render(<SessionTimeline state={makeState()} />);
      const event = screen.getByTestId("timeline-event-101-completed");
      expect(event.textContent).toContain("[101]");
    });

    it("shows task titles", () => {
      render(<SessionTimeline state={makeState()} />);
      expect(screen.getByText("Scaffold project")).toBeDefined();
      expect(screen.getByText("Add data model")).toBeDefined();
      expect(screen.getByText("Setup testing")).toBeDefined();
    });

    it("shows event type badges", () => {
      render(<SessionTimeline state={makeState()} />);
      const completedBadges = screen.getAllByTestId("event-badge-completed");
      expect(completedBadges).toHaveLength(2);
      expect(screen.getByTestId("event-badge-failed")).toBeDefined();
    });

    it("shows duration for completed events", () => {
      render(<SessionTimeline state={makeState()} />);
      expect(screen.getByTestId("duration-101").textContent).toBe(
        "Duration: 45s",
      );
    });

    it("shows attempts for completed events", () => {
      render(<SessionTimeline state={makeState()} />);
      expect(screen.getByTestId("attempts-101").textContent).toBe(
        "Attempts: 1/3",
      );
    });

    it("shows status for completed events", () => {
      render(<SessionTimeline state={makeState()} />);
      expect(screen.getByTestId("status-101").textContent).toBe(
        "Status: PASS",
      );
    });
  });

  describe("started events", () => {
    it("renders started events with blue badge", () => {
      const timeline = makeTimeline({
        events: [
          makeEvent({ taskId: "101", type: "started", duration: null, status: null, attempts: null }),
        ],
        summary: makeSummary({ tasksCompleted: 0, tasksRunning: 1 }),
      });
      render(
        <SessionTimeline state={makeState({ timeline })} />,
      );
      expect(
        screen.getByTestId("timeline-event-101-started"),
      ).toBeDefined();
      expect(screen.getByTestId("event-badge-started")).toBeDefined();
      expect(screen.getByTestId("event-badge-started").textContent).toBe(
        "Started",
      );
    });

    it("does not show duration for started events", () => {
      const timeline = makeTimeline({
        events: [
          makeEvent({ taskId: "101", type: "started", duration: null, status: null, attempts: null }),
        ],
        summary: makeSummary({ tasksCompleted: 0, tasksRunning: 1 }),
      });
      render(
        <SessionTimeline state={makeState({ timeline })} />,
      );
      expect(screen.queryByTestId("duration-101")).toBeNull();
    });
  });

  describe("color coding", () => {
    it("started events have blue dot", () => {
      const timeline = makeTimeline({
        events: [
          makeEvent({ taskId: "101", type: "started", duration: null, status: null, attempts: null }),
        ],
        summary: makeSummary({ tasksCompleted: 0, tasksRunning: 1 }),
      });
      render(
        <SessionTimeline state={makeState({ timeline })} />,
      );
      const event = screen.getByTestId("timeline-event-101-started");
      const dot = event.querySelector("[class*='bg-blue-500']");
      expect(dot).not.toBeNull();
    });

    it("completed events have green dot", () => {
      render(<SessionTimeline state={makeState()} />);
      const event = screen.getByTestId("timeline-event-101-completed");
      const dot = event.querySelector("[class*='bg-green-500']");
      expect(dot).not.toBeNull();
    });

    it("failed events have red dot", () => {
      render(<SessionTimeline state={makeState()} />);
      const event = screen.getByTestId("timeline-event-103-failed");
      const dot = event.querySelector("[class*='bg-red-500']");
      expect(dot).not.toBeNull();
    });
  });

  describe("scrollable timeline", () => {
    it("events container is scrollable", () => {
      render(<SessionTimeline state={makeState()} />);
      const container = screen.getByTestId("timeline-events");
      expect(container.className).toContain("overflow-y-auto");
    });

    it("handles 50+ events", () => {
      const manyEvents: TimelineEvent[] = Array.from(
        { length: 55 },
        (_, i) =>
          makeEvent({
            taskId: String(i + 1),
            title: `Task ${i + 1}`,
            order: i,
          }),
      );
      const timeline = makeTimeline({
        events: manyEvents,
        summary: makeSummary({ tasksCompleted: 55 }),
      });
      render(<SessionTimeline state={makeState({ timeline })} />);
      const container = screen.getByTestId("timeline-events");
      expect(container.children.length).toBe(55);
      // Summary section is still visible outside the scrollable area
      expect(
        screen.getByTestId("timeline-summary-section"),
      ).toBeDefined();
    });
  });

  describe("parse warnings", () => {
    it("shows warning when error is present", () => {
      render(
        <SessionTimeline
          state={makeState({ error: "Unexpected format" })}
        />,
      );
      expect(screen.getByTestId("timeline-warning")).toBeDefined();
      expect(
        screen.getByText(/Parse warning: Unexpected format/),
      ).toBeDefined();
    });

    it("shows warning for malformed entries", () => {
      const timeline = makeTimeline({ malformedCount: 3 });
      render(
        <SessionTimeline state={makeState({ timeline })} />,
      );
      expect(screen.getByTestId("timeline-warning")).toBeDefined();
      expect(
        screen.getByText(/3 malformed entries skipped/),
      ).toBeDefined();
    });

    it("does not show warning when no issues", () => {
      render(
        <SessionTimeline state={makeState({ error: null })} />,
      );
      expect(screen.queryByTestId("timeline-warning")).toBeNull();
    });

    it("shows malformed indicator on individual events", () => {
      const timeline = makeTimeline({
        events: [makeEvent({ taskId: "101", isMalformed: true })],
      });
      render(
        <SessionTimeline state={makeState({ timeline })} />,
      );
      expect(screen.getByTestId("malformed-101")).toBeDefined();
    });
  });

  describe("header", () => {
    it("shows Session Timeline heading", () => {
      render(<SessionTimeline state={makeState()} />);
      expect(screen.getByText("Session Timeline")).toBeDefined();
    });
  });
});

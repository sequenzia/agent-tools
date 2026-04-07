import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, act, fireEvent } from "@testing-library/react";
import { useRef } from "react";
import { useFocusTrap } from "../use-focus-trap";

afterEach(() => {
  cleanup();
});

function FocusTrapTestHarness({ isActive }: { isActive: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(containerRef, isActive);

  return (
    <div>
      <button data-testid="outside-btn">Outside</button>
      <div ref={containerRef} data-testid="trap-container" tabIndex={-1}>
        <button data-testid="first-btn">First</button>
        <button data-testid="second-btn">Second</button>
        <button data-testid="third-btn">Third</button>
      </div>
    </div>
  );
}

function EmptyTrapHarness({ isActive }: { isActive: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(containerRef, isActive);

  return (
    <div>
      <button data-testid="outside-btn">Outside</button>
      <div ref={containerRef} data-testid="trap-container" tabIndex={-1}>
        <span>No focusable elements</span>
      </div>
    </div>
  );
}

describe("useFocusTrap", () => {
  it("moves focus to first focusable element when activated", async () => {
    render(<FocusTrapTestHarness isActive={true} />);

    // Wait for requestAnimationFrame
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(r));
    });

    const firstBtn = document.querySelector('[data-testid="first-btn"]') as HTMLElement;
    expect(document.activeElement).toBe(firstBtn);
  });

  it("does not move focus when inactive", async () => {
    const { getByTestId } = render(<FocusTrapTestHarness isActive={false} />);

    // Focus outside button
    const outsideBtn = getByTestId("outside-btn") as HTMLElement;
    outsideBtn.focus();

    await act(async () => {
      await new Promise((r) => requestAnimationFrame(r));
    });

    // Focus should remain on the outside button
    expect(document.activeElement).toBe(outsideBtn);
  });

  it("wraps Tab from last to first element", async () => {
    render(<FocusTrapTestHarness isActive={true} />);

    await act(async () => {
      await new Promise((r) => requestAnimationFrame(r));
    });

    // Focus the last button
    const thirdBtn = document.querySelector('[data-testid="third-btn"]') as HTMLElement;
    thirdBtn.focus();
    expect(document.activeElement).toBe(thirdBtn);

    // Press Tab on the last element
    fireEvent.keyDown(document, { key: "Tab", bubbles: true });

    // Focus should wrap to first
    const firstBtn = document.querySelector('[data-testid="first-btn"]') as HTMLElement;
    expect(document.activeElement).toBe(firstBtn);
  });

  it("wraps Shift+Tab from first to last element", async () => {
    render(<FocusTrapTestHarness isActive={true} />);

    await act(async () => {
      await new Promise((r) => requestAnimationFrame(r));
    });

    // Focus should be on first button after activation
    const firstBtn = document.querySelector('[data-testid="first-btn"]') as HTMLElement;
    expect(document.activeElement).toBe(firstBtn);

    // Press Shift+Tab on the first element
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true, bubbles: true });

    // Focus should wrap to last
    const thirdBtn = document.querySelector('[data-testid="third-btn"]') as HTMLElement;
    expect(document.activeElement).toBe(thirdBtn);
  });

  it("focuses container when no focusable children exist", async () => {
    render(<EmptyTrapHarness isActive={true} />);

    await act(async () => {
      await new Promise((r) => requestAnimationFrame(r));
    });

    const container = document.querySelector('[data-testid="trap-container"]') as HTMLElement;
    expect(document.activeElement).toBe(container);
  });
});

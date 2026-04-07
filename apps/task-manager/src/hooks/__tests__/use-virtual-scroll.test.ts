import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, cleanup } from "@testing-library/react";
import { useVirtualScroll } from "../use-virtual-scroll";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useVirtualScroll", () => {
  describe("below threshold", () => {
    it("does not activate virtual scrolling for small lists", () => {
      const { result } = renderHook(() =>
        useVirtualScroll({ itemCount: 20, itemHeight: 88 }),
      );

      expect(result.current.isVirtual).toBe(false);
      expect(result.current.startIndex).toBe(0);
      expect(result.current.endIndex).toBe(20);
      expect(result.current.topPadding).toBe(0);
      expect(result.current.bottomPadding).toBe(0);
    });

    it("shows all items when below threshold", () => {
      const { result } = renderHook(() =>
        useVirtualScroll({ itemCount: 49, itemHeight: 88, threshold: 50 }),
      );

      expect(result.current.isVirtual).toBe(false);
      expect(result.current.startIndex).toBe(0);
      expect(result.current.endIndex).toBe(49);
    });
  });

  describe("above threshold", () => {
    it("activates virtual scrolling for large lists", () => {
      const { result } = renderHook(() =>
        useVirtualScroll({ itemCount: 100, itemHeight: 88, threshold: 50 }),
      );

      expect(result.current.isVirtual).toBe(true);
    });

    it("calculates totalHeight based on item count and height", () => {
      const { result } = renderHook(() =>
        useVirtualScroll({ itemCount: 100, itemHeight: 88, threshold: 50 }),
      );

      expect(result.current.totalHeight).toBe(100 * 88);
    });

    it("limits rendered items to viewport plus overscan", () => {
      const { result } = renderHook(() =>
        useVirtualScroll({
          itemCount: 500,
          itemHeight: 88,
          threshold: 50,
          overscan: 5,
        }),
      );

      // Without any scrolling and with 0 containerHeight,
      // visibleStart = 0, visibleEnd = 0 (ceil(0/88) = 0)
      // startIndex = max(0, 0 - 5) = 0
      // endIndex = min(500, 0 + 5) = 5
      expect(result.current.startIndex).toBe(0);
      expect(result.current.endIndex).toBeLessThanOrEqual(10);
    });
  });

  describe("custom threshold", () => {
    it("uses custom threshold value", () => {
      const { result: result20 } = renderHook(() =>
        useVirtualScroll({ itemCount: 25, itemHeight: 88, threshold: 20 }),
      );
      expect(result20.current.isVirtual).toBe(true);

      const { result: result100 } = renderHook(() =>
        useVirtualScroll({ itemCount: 80, itemHeight: 88, threshold: 100 }),
      );
      expect(result100.current.isVirtual).toBe(false);
    });
  });

  describe("containerRef", () => {
    it("provides a ref callback for the container", () => {
      const { result } = renderHook(() =>
        useVirtualScroll({ itemCount: 100, itemHeight: 88, threshold: 50 }),
      );

      expect(typeof result.current.containerRef).toBe("function");
    });
  });

  describe("handleScroll", () => {
    it("provides a scroll handler", () => {
      const { result } = renderHook(() =>
        useVirtualScroll({ itemCount: 100, itemHeight: 88, threshold: 50 }),
      );

      expect(typeof result.current.handleScroll).toBe("function");
    });
  });

  describe("500 task column", () => {
    it("only renders a subset of 500 tasks", () => {
      const { result } = renderHook(() =>
        useVirtualScroll({
          itemCount: 500,
          itemHeight: 88,
          threshold: 50,
          overscan: 5,
        }),
      );

      expect(result.current.isVirtual).toBe(true);
      const renderedCount = result.current.endIndex - result.current.startIndex;
      expect(renderedCount).toBeLessThan(500);
    });

    it("provides proper padding for off-screen items", () => {
      const { result } = renderHook(() =>
        useVirtualScroll({
          itemCount: 500,
          itemHeight: 88,
          threshold: 50,
          overscan: 5,
        }),
      );

      const totalHeight = result.current.topPadding +
        (result.current.endIndex - result.current.startIndex) * 88 +
        result.current.bottomPadding;

      // Total height should approximate the full list
      expect(totalHeight).toBe(500 * 88);
    });
  });

  describe("edge cases", () => {
    it("handles empty list", () => {
      const { result } = renderHook(() =>
        useVirtualScroll({ itemCount: 0, itemHeight: 88 }),
      );

      expect(result.current.isVirtual).toBe(false);
      expect(result.current.startIndex).toBe(0);
      expect(result.current.endIndex).toBe(0);
    });

    it("handles single item", () => {
      const { result } = renderHook(() =>
        useVirtualScroll({ itemCount: 1, itemHeight: 88 }),
      );

      expect(result.current.isVirtual).toBe(false);
      expect(result.current.startIndex).toBe(0);
      expect(result.current.endIndex).toBe(1);
    });

    it("handles exact threshold value", () => {
      const { result } = renderHook(() =>
        useVirtualScroll({ itemCount: 50, itemHeight: 88, threshold: 50 }),
      );

      // At exactly the threshold, virtual scrolling should NOT activate (> not >=)
      expect(result.current.isVirtual).toBe(false);
    });
  });
});

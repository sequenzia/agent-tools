import { useState, useCallback, useEffect, useMemo } from "react";

/**
 * Lightweight virtual scrolling hook for kanban columns.
 *
 * Only renders items that are within or near the visible viewport,
 * using a top/bottom spacer to maintain scroll height.
 *
 * Activates only when item count exceeds a threshold (default: 50).
 * Below the threshold, all items are rendered normally to avoid overhead.
 */

export interface VirtualScrollConfig {
  /** Total number of items. */
  itemCount: number;
  /** Height of each item in pixels (including gap). */
  itemHeight: number;
  /** Number of items to render above/below the viewport as buffer. */
  overscan?: number;
  /** Minimum item count to activate virtual scrolling. */
  threshold?: number;
}

export interface VirtualScrollResult {
  /** Whether virtual scrolling is active. */
  isVirtual: boolean;
  /** Index of the first visible item (for slicing). */
  startIndex: number;
  /** Index past the last visible item (for slicing). */
  endIndex: number;
  /** Top spacer height in pixels. */
  topPadding: number;
  /** Bottom spacer height in pixels. */
  bottomPadding: number;
  /** Total container height in pixels (for the scroll container). */
  totalHeight: number;
  /** Ref callback for the scroll container. */
  containerRef: (node: HTMLDivElement | null) => void;
  /** Handler for scroll events — attach to onScroll on the container. */
  handleScroll: (e: React.UIEvent<HTMLDivElement>) => void;
}

const DEFAULT_OVERSCAN = 5;
const DEFAULT_THRESHOLD = 50;

export function useVirtualScroll(config: VirtualScrollConfig): VirtualScrollResult {
  const { itemCount, itemHeight, overscan = DEFAULT_OVERSCAN, threshold = DEFAULT_THRESHOLD } = config;

  // Track the container node via state (not ref) to avoid lint issues
  const [containerNode, setContainerNode] = useState<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  const isVirtual = itemCount > threshold;

  // Callback ref to capture the container DOM element
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    setContainerNode(node);
    if (node) {
      setContainerHeight(node.clientHeight);
    }
  }, []);

  // Observe container size changes
  useEffect(() => {
    if (!containerNode || !isVirtual) return;

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    observer.observe(containerNode);
    return () => observer.disconnect();
  }, [containerNode, isVirtual]);

  // Scroll handler reads scrollTop from the event target (no ref access)
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const result = useMemo(() => {
    if (!isVirtual) {
      return {
        isVirtual: false as const,
        startIndex: 0,
        endIndex: itemCount,
        topPadding: 0,
        bottomPadding: 0,
        totalHeight: itemCount * itemHeight,
      };
    }

    const totalHeight = itemCount * itemHeight;

    // Calculate visible range
    const visibleStart = Math.floor(scrollTop / itemHeight);
    const visibleEnd = Math.ceil((scrollTop + containerHeight) / itemHeight);

    // Apply overscan
    const startIndex = Math.max(0, visibleStart - overscan);
    const endIndex = Math.min(itemCount, visibleEnd + overscan);

    // Calculate padding
    const topPadding = startIndex * itemHeight;
    const bottomPadding = Math.max(0, (itemCount - endIndex) * itemHeight);

    return {
      isVirtual: true as const,
      startIndex,
      endIndex,
      topPadding,
      bottomPadding,
      totalHeight,
    };
  }, [isVirtual, itemCount, itemHeight, scrollTop, containerHeight, overscan]);

  return {
    ...result,
    containerRef,
    handleScroll,
  };
}

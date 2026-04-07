import { useEffect, useRef, useCallback, type RefObject } from "react";

/**
 * Focusable element selector for focus trap.
 * Matches interactive elements that are visible and not disabled.
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Hook that traps keyboard focus within a container element.
 * When active, Tab/Shift+Tab cycle through focusable elements
 * within the container. Focus moves to the first focusable element
 * when the trap activates, and restores to the previously focused
 * element when the trap deactivates.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  isActive: boolean,
): void {
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const getFocusableElements = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return [];
    return Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    ).filter((el) => {
      // Filter out elements that are hidden (display:none or visibility:hidden)
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
  }, [containerRef]);

  // Activate: save previous focus and move focus into the container
  useEffect(() => {
    if (!isActive) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement;

    // Delay focus to allow the panel to render
    const timer = requestAnimationFrame(() => {
      const focusable = getFocusableElements();
      if (focusable.length > 0) {
        focusable[0].focus();
      } else if (containerRef.current) {
        // If no focusable children, focus the container itself
        containerRef.current.focus();
      }
    });

    return () => cancelAnimationFrame(timer);
  }, [isActive, containerRef, getFocusableElements]);

  // Deactivate: restore focus to the previously focused element
  useEffect(() => {
    if (isActive) return;
    return () => {
      if (previouslyFocusedRef.current && typeof previouslyFocusedRef.current.focus === 'function') {
        previouslyFocusedRef.current.focus();
      }
    };
  }, [isActive]);

  // Trap Tab/Shift+Tab within the container
  useEffect(() => {
    if (!isActive) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;

      const focusable = getFocusableElements();
      if (focusable.length === 0) return;

      const firstFocusable = focusable[0];
      const lastFocusable = focusable[focusable.length - 1];

      if (e.shiftKey) {
        // Shift+Tab: if focus is on the first element, wrap to last
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable.focus();
        }
      } else {
        // Tab: if focus is on the last element, wrap to first
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isActive, getFocusableElements]);
}

import { useState, useCallback, useRef, useEffect, createContext, useContext } from "react";

/**
 * Context for announcing messages to screen readers via ARIA live regions.
 * Components use `announce()` to send transient messages that screen readers
 * will read aloud without disrupting the visual UI.
 */

interface LiveRegionContextValue {
  /** Announce a message to screen readers. */
  announce: (message: string, priority?: "polite" | "assertive") => void;
}

const LiveRegionContext = createContext<LiveRegionContextValue>({
  announce: () => {},
});

/**
 * Hook to access the live region announcer.
 * Components call `announce("message")` to notify screen readers of changes.
 */
export function useLiveAnnouncer(): LiveRegionContextValue {
  return useContext(LiveRegionContext);
}

/**
 * Provider component that renders hidden ARIA live regions and provides
 * an announce() function to child components.
 *
 * Renders two live regions:
 * - `aria-live="polite"` for non-urgent updates (task moved, filter changed)
 * - `aria-live="assertive"` for urgent updates (errors, conflicts)
 *
 * Messages are cleared after 5 seconds to avoid stale announcements.
 */
export function LiveRegionProvider({ children }: { children: React.ReactNode }) {
  const [politeMessage, setPoliteMessage] = useState("");
  const [assertiveMessage, setAssertiveMessage] = useState("");
  const politeTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const assertiveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const announce = useCallback((message: string, priority: "polite" | "assertive" = "polite") => {
    if (priority === "assertive") {
      // Clear and re-set to trigger re-read even if same message
      setAssertiveMessage("");
      requestAnimationFrame(() => {
        setAssertiveMessage(message);
      });
      clearTimeout(assertiveTimerRef.current);
      assertiveTimerRef.current = setTimeout(() => setAssertiveMessage(""), 5000);
    } else {
      setPoliteMessage("");
      requestAnimationFrame(() => {
        setPoliteMessage(message);
      });
      clearTimeout(politeTimerRef.current);
      politeTimerRef.current = setTimeout(() => setPoliteMessage(""), 5000);
    }
  }, []);

  // Cleanup timers
  useEffect(() => {
    return () => {
      clearTimeout(politeTimerRef.current);
      clearTimeout(assertiveTimerRef.current);
    };
  }, []);

  return (
    <LiveRegionContext.Provider value={{ announce }}>
      {children}
      {/* Visually hidden live regions - screen readers only */}
      <div
        aria-live="polite"
        aria-atomic="true"
        role="status"
        className="sr-only"
        data-testid="live-region-polite"
      >
        {politeMessage}
      </div>
      <div
        aria-live="assertive"
        aria-atomic="true"
        role="alert"
        className="sr-only"
        data-testid="live-region-assertive"
      >
        {assertiveMessage}
      </div>
    </LiveRegionContext.Provider>
  );
}

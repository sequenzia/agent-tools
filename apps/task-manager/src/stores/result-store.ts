import { create } from "zustand";
import {
  fetchResult,
  fetchAllResults,
  type ParsedResult,
} from "../services/result-service";

interface ResultState {
  /** All parsed results, keyed by filename for deduplication. */
  results: Map<string, ParsedResult>;
  /** Whether initial loading is in progress. */
  isLoading: boolean;
  /** Error from the last operation. */
  error: string | null;

  /** Load all existing result files from the session directory. */
  loadAllResults: (projectPath: string) => Promise<void>;
  /** Add or update a single result by fetching it from disk. */
  addResult: (projectPath: string, filename: string) => Promise<void>;
  /** Remove a result (when the file is deleted). */
  removeResult: (filename: string) => void;
  /** Clear all results (when session ends). */
  clearResults: () => void;
  /** Get results sorted by receivedAt descending (newest first). */
  getSortedResults: () => ParsedResult[];
}

export const useResultStore = create<ResultState>((set, get) => ({
  results: new Map(),
  isLoading: false,
  error: null,

  loadAllResults: async (projectPath: string) => {
    set({ isLoading: true, error: null });

    try {
      const parsed = await fetchAllResults(projectPath);
      const newMap = new Map<string, ParsedResult>();
      for (const result of parsed) {
        newMap.set(result.filename, result);
      }
      set({ results: newMap, isLoading: false });
    } catch (err) {
      set({
        isLoading: false,
        error:
          err instanceof Error
            ? err.message
            : typeof err === "string"
              ? err
              : "Failed to load results",
      });
    }
  },

  addResult: async (projectPath: string, filename: string) => {
    try {
      const parsed = await fetchResult(projectPath, filename);
      if (parsed) {
        set((state) => {
          const newMap = new Map(state.results);
          newMap.set(filename, parsed);
          return { results: newMap };
        });
      }
    } catch (err) {
      set({
        error:
          err instanceof Error
            ? err.message
            : typeof err === "string"
              ? err
              : "Failed to fetch result",
      });
    }
  },

  removeResult: (filename: string) => {
    set((state) => {
      const newMap = new Map(state.results);
      newMap.delete(filename);
      return { results: newMap };
    });
  },

  clearResults: () => {
    set({ results: new Map(), isLoading: false, error: null });
  },

  getSortedResults: () => {
    const { results } = get();
    return Array.from(results.values()).sort(
      (a, b) => b.receivedAt - a.receivedAt,
    );
  },
}));

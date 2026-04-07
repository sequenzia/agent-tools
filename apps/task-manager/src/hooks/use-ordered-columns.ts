import { useMemo, useCallback } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { useSettingsStore } from "../stores/settings-store";
import type { BoardColumn } from "../components/KanbanBoard";
import { DEFAULT_COLUMN_ORDER } from "../types/settings";
import type { BoardColumnValue } from "../types/settings";

/**
 * Derives the ordered, visibility-filtered list of board columns from settings.
 * Returns the column list and a reorder function for DnD integration.
 */
export function useOrderedColumns(): {
  orderedColumns: BoardColumn[];
  reorderColumns: (activeColumn: BoardColumn, overColumn: BoardColumn) => void;
} {
  const settings = useSettingsStore((s) => s.settings);
  const setColumnOrder = useSettingsStore((s) => s.setColumnOrder);

  const orderedColumns = useMemo<BoardColumn[]>(() => {
    const order = (settings.uiPreferences.columnOrder ?? DEFAULT_COLUMN_ORDER) as BoardColumn[];
    const visibility = settings.uiPreferences.columnVisibility;
    return order.filter((col) => visibility[col] !== false);
  }, [settings.uiPreferences.columnOrder, settings.uiPreferences.columnVisibility]);

  const reorderColumns = useCallback(
    (activeColumn: BoardColumn, overColumn: BoardColumn) => {
      const fullOrder = (settings.uiPreferences.columnOrder ?? [...DEFAULT_COLUMN_ORDER]) as BoardColumnValue[];
      const oldIndex = fullOrder.indexOf(activeColumn as BoardColumnValue);
      const newIndex = fullOrder.indexOf(overColumn as BoardColumnValue);
      if (oldIndex === -1 || newIndex === -1) return;
      const newOrder = arrayMove(fullOrder, oldIndex, newIndex);
      void setColumnOrder(newOrder);
    },
    [settings.uiPreferences.columnOrder, setColumnOrder],
  );

  return { orderedColumns, reorderColumns };
}

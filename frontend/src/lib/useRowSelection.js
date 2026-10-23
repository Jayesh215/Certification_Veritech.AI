import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Checkbox selection for paginated list rows keyed by id.
 */
export default function useRowSelection(pageItems, getId) {
  const [selected, setSelected] = useState(() => new Set());

  const pageIds = useMemo(
    () => (pageItems || []).map((row) => getId(row)).filter(Boolean),
    [pageItems, getId],
  );

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  // Drop selections that no longer exist after reload/filter.
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      // Keep ids even if not on current page (user may multi-page select).
      return prev;
    });
  }, [pageIds]);

  const toggle = useCallback((id) => {
    if (!id) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const togglePage = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allOnPage = pageIds.length > 0 && pageIds.every((id) => next.has(id));
      if (allOnPage) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }, [pageIds]);

  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const somePageSelected = pageIds.some((id) => selected.has(id));

  return {
    selected,
    selectedIds: [...selected],
    selectedCount: selected.size,
    isSelected: (id) => selected.has(id),
    toggle,
    togglePage,
    clearSelection,
    allPageSelected,
    somePageSelected,
  };
}

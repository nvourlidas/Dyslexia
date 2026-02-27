// src/hooks/useColumnVisibility.ts
import { useEffect, useState } from "react";

export function useColumnVisibility<K extends string>(params: {
  allKeys: readonly K[];
  defaultVisible: readonly K[];
  storageKeyBase: string; // e.g. "students_table_visible_cols_v1"
  tenantId?: string | null;
}) {
  const { allKeys, defaultVisible, storageKeyBase, tenantId } = params;

  const globalKey = storageKeyBase;
  const tenantKey = tenantId ? `${storageKeyBase}_${tenantId}` : null;

  function sanitize(input: unknown): K[] {
    if (!Array.isArray(input)) return [...defaultVisible];
    const valid = input.filter((k): k is K => allKeys.includes(k as K));
    return valid.length ? valid : [...defaultVisible];
  }

  const [visibleCols, setVisibleCols] = useState<K[]>(() => {
    try {
      const raw = localStorage.getItem(globalKey);
      if (!raw) return [...defaultVisible];
      return sanitize(JSON.parse(raw));
    } catch {
      return [...defaultVisible];
    }
  });

  // Prefer tenant key if exists
  useEffect(() => {
    if (!tenantKey) return;
    try {
      const raw = localStorage.getItem(tenantKey);
      if (!raw) return;
      setVisibleCols(sanitize(JSON.parse(raw)));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantKey]);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(globalKey, JSON.stringify(visibleCols));
      if (tenantKey) localStorage.setItem(tenantKey, JSON.stringify(visibleCols));
    } catch {}
  }, [visibleCols, globalKey, tenantKey]);

  const isColVisible = (key: K) => visibleCols.includes(key);

  const toggleCol = (key: K) => {
    setVisibleCols((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const setAllCols = () => setVisibleCols([...allKeys]);
  const resetCols = () => setVisibleCols([...defaultVisible]);

  return {
    visibleCols,
    setVisibleCols,
    isColVisible,
    toggleCol,
    setAllCols,
    resetCols,
    globalKey,
    tenantKey,
  };
}
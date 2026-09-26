import { useCallback, useEffect, useState } from 'react';
import type { PoiSearchTab } from '../lib/poiSearchHelpers';

export type PoiEntryIntent = 'new' | 'master' | 'alternate';

/** A choice belongs to one source and one entry operation. */
export function usePoiSelection<T>(source: PoiSearchTab, intent: PoiEntryIntent, multiple: boolean) {
  const scope = `${source}:${intent}`;
  const [state, setState] = useState<{ scope: string; items: Array<{ key: string | number; value: T }> }>({ scope, items: [] });
  const selected = state.scope === scope ? state.items : [];

  useEffect(() => {
    setState((previous) => previous.scope === scope ? previous : { scope, items: [] });
  }, [scope]);

  const clear = useCallback(() => setState({ scope, items: [] }), [scope]);
  const choose = useCallback((key: string | number, value: T) => {
    setState({ scope, items: [{ key, value }] });
  }, [scope]);
  const toggle = useCallback((key: string | number, value: T) => {
    setState((previous) => {
      const items = previous.scope === scope ? previous.items : [];
      const exists = items.some((item) => item.key === key);
      return {
        scope,
        items: exists ? items.filter((item) => item.key !== key) : multiple ? [...items, { key, value }] : [{ key, value }],
      };
    });
  }, [scope, multiple]);
  const remove = useCallback((key: string | number) => {
    setState((previous) => previous.scope === scope
      ? { scope, items: previous.items.filter((item) => item.key !== key) }
      : previous);
  }, [scope]);

  return { selected, choose, toggle, remove, clear };
}

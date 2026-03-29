/* ===== DocCard — 統一渲染所有 doc type ===== */

import { useMemo } from 'react';
import { renderMarkdown } from '../../lib/sanitize';

export interface DocEntry {
  id?: number;
  sort_order?: number;
  section: string;
  title: string;
  content: string;
}

interface DocCardProps {
  entries: DocEntry[];
}

export default function DocCard({ entries }: DocCardProps) {
  const groups = useMemo(() => {
    const map = new Map<string, DocEntry[]>();
    for (const e of entries) {
      const key = e.section || '';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return [...map.entries()];
  }, [entries]);

  if (entries.length === 0) return null;

  return (
    <>
      {groups.map(([section, items]) => (
        <div key={section || '_'}>
          {section && (
            <p className="text-callout font-medium text-accent mt-4 mb-1 flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-accent shrink-0" />
              {section}
            </p>
          )}
          <div className="rounded-md bg-accent-bg divide-y divide-border">
            {items.map((e, i) => (
              <div key={e.id ?? i} className="px-3 py-2">
                {e.title && <span className="font-medium text-body">{e.title}</span>}
                {e.content && (
                  <div
                    className="text-callout text-muted mt-0.5 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(e.content) }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

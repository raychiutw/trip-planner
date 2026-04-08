/* ===== DocCard — 卡牌化渲染（全底色 + 優先級 badge） ===== */

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

/* ===== Priority detection from Chinese text ===== */

type Priority = 'high' | 'medium' | 'low' | 'neutral';

const HIGH_KEYWORDS = /必做|必知|重要|緊急|務必|一定要|不可|禁止|截止|報到/;
const MEDIUM_KEYWORDS = /建議|備用|備案|注意|提醒|記得|別忘|盡量|推薦/;
const LOW_KEYWORDS = /參考|可以|順便|有空|不急|小提醒|額外|補充/;

function detectPriority(section: string, title: string, content: string): Priority {
  const text = `${section} ${title} ${content}`;
  if (HIGH_KEYWORDS.test(text)) return 'high';
  if (MEDIUM_KEYWORDS.test(text)) return 'medium';
  if (LOW_KEYWORDS.test(text)) return 'low';
  return 'neutral';
}

const PRIORITY_CARD_CLASS: Record<Priority, string> = {
  high: 'bg-priority-high-bg',
  medium: 'bg-priority-medium-bg',
  low: 'bg-priority-low-bg',
  neutral: 'bg-background',
};

const PRIORITY_BADGE: Record<Priority, { label: string; class: string } | null> = {
  high: { label: '重要', class: 'bg-priority-high-dot text-white' },
  medium: { label: '建議', class: 'bg-priority-medium-dot text-white' },
  low: { label: '參考', class: 'bg-priority-low-dot text-white' },
  neutral: null,
};

/** Defensive: ensure a value is a renderable string (legacy data may contain objects) */
function safeStr(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v == null) return '';
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>;
    if (typeof obj.text === 'string') return obj.text;
    if (typeof obj.label === 'string') return obj.label;
    return JSON.stringify(v);
  }
  return String(v);
}

export default function DocCard({ entries }: DocCardProps) {
  const groups = useMemo(() => {
    const map = new Map<string, DocEntry[]>();
    for (const e of entries) {
      const key = safeStr(e.section);
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
            <p className="text-callout font-medium text-accent mt-4 mb-2 flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-accent shrink-0" />
              {section}
            </p>
          )}
          <div className="flex flex-col gap-2">
            {items.map((e, i) => {
              const title = safeStr(e.title);
              const content = safeStr(e.content);
              const section = safeStr(e.section);
              const priority = detectPriority(section, title, content);
              const badge = PRIORITY_BADGE[priority];
              return (
                <div key={e.id ?? i} className={`rounded-md px-3.5 py-2.5 ${PRIORITY_CARD_CLASS[priority]}`}>
                  <div className="flex items-center gap-1.5">
                    {badge && (
                      <span className={`inline-flex text-caption2 font-bold px-1.5 py-0.5 rounded-full leading-none ${badge.class}`}>
                        {badge.label}
                      </span>
                    )}
                    {title && <span className="font-semibold text-body">{title}</span>}
                  </div>
                  {content && (
                    <div
                      className="text-callout text-muted mt-1 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

/**
 * SuggestionSheet — 3-tier priority AI 建議 renderer (editor.jsx SuggestInfo 對照)
 *
 * 用 DocCard 既有的 priority 偵測，把 entries 分成 高/中/低 三層展示：
 *  - 高：朱紅 (#C13515) + "強烈建議"
 *  - 中：橙 (#F48C06) + "建議考慮"
 *  - 低：灰 (#6A6A6A) + "有興趣再看"
 *
 * 每張卡 left-border accent + 標題 + 原因 (從 content 擷取首段 or note)
 */

import { memo, useMemo } from 'react';
import { renderMarkdown } from '../../lib/sanitize';
import type { DocEntry } from './DocCard';

type Tier = 'high' | 'medium' | 'low';

const HIGH_KEYWORDS = /必做|必知|重要|緊急|務必|一定要|不可|禁止|截止|報到|強烈|影響最大/;
const LOW_KEYWORDS = /參考|可以|順便|有空|不急|小提醒|額外|補充|有興趣|錦上添花/;

function detectTier(section: string, title: string, content: string): Tier {
  const text = `${section} ${title} ${content}`;
  if (HIGH_KEYWORDS.test(text)) return 'high';
  if (LOW_KEYWORDS.test(text)) return 'low';
  return 'medium'; // default to medium for neutral
}

const TIER_META: Record<Tier, { label: string; reason: string; cvar: string; bgvar: string }> = {
  high: {
    label: '強烈建議',
    reason: '影響體驗最大，建議立即處理',
    cvar: 'var(--color-destructive)',
    bgvar: 'var(--color-destructive-bg)',
  },
  medium: {
    label: '建議考慮',
    reason: '可優化但非必要，建議安排進行',
    cvar: 'var(--color-warning)',
    bgvar: 'var(--color-warning-bg)',
  },
  low: {
    label: '有興趣再看',
    reason: '錦上添花，有時間再考慮',
    cvar: 'var(--color-muted)',
    bgvar: 'var(--color-tertiary)',
  },
};

interface TieredEntry {
  entry: DocEntry;
  tier: Tier;
}

interface SuggestionSheetProps {
  entries: DocEntry[];
}

const SuggestionSheet = memo(function SuggestionSheet({ entries }: SuggestionSheetProps) {
  const grouped = useMemo(() => {
    const all: TieredEntry[] = entries.map((e) => ({
      entry: e,
      tier: detectTier(e.section, e.title, e.content),
    }));
    const high = all.filter((x) => x.tier === 'high');
    const medium = all.filter((x) => x.tier === 'medium');
    const low = all.filter((x) => x.tier === 'low');
    return { high, medium, low };
  }, [entries]);

  if (!entries || entries.length === 0) {
    return <p className="text-callout text-muted text-center py-4">尚無建議</p>;
  }

  const total = entries.length;
  const tiers: { tier: Tier; items: TieredEntry[] }[] = [
    { tier: 'high', items: grouped.high },
    { tier: 'medium', items: grouped.medium },
    { tier: 'low', items: grouped.low },
  ];

  return (
    <div className="p-padding-h">
      {/* Intro card */}
      <div className="ocean-side-card mb-4 flex gap-3 items-center">
        <div
          className="w-9 h-9 rounded-md grid place-items-center text-white flex-shrink-0"
          style={{ background: 'var(--color-accent)' }}
          aria-hidden="true"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3 L14 10 L21 12 L14 14 L12 21 L10 14 L3 12 L10 10 Z" />
          </svg>
        </div>
        <div className="flex-1 text-caption text-muted leading-normal">
          根據你的<b className="text-foreground">偏好、季節、天氣與目前行程</b>產生 {total} 則建議，分為三層優先度
        </div>
      </div>

      {tiers.map(({ tier, items }) => {
        if (items.length === 0) return null;
        const meta = TIER_META[tier];
        return (
          <section key={tier} className="mb-5">
            <div className="flex items-center gap-3 mb-3">
              <span
                className="px-2.5 py-1 rounded text-[11px] font-extrabold tracking-wider text-white"
                style={{ background: meta.cvar }}
              >
                {tier === 'high' ? '高' : tier === 'medium' ? '中' : '低'}
              </span>
              <div>
                <div className="text-footnote font-extrabold">{meta.label}</div>
                <div className="text-caption2 text-muted">{meta.reason}</div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {items.map(({ entry }) => (
                <article
                  key={entry.id ?? `${entry.section}-${entry.title}`}
                  className="rounded-md border border-border bg-background p-3"
                  style={{ borderLeftWidth: 4, borderLeftColor: meta.cvar }}
                >
                  <div className="text-footnote font-bold leading-snug">{entry.title}</div>
                  {entry.content && (
                    <div
                      className="text-caption text-muted mt-1.5 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(entry.content) }}
                    />
                  )}
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
});

export default SuggestionSheet;

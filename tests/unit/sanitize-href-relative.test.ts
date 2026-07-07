// @vitest-environment jsdom
/**
 * v2.31.26 fix #127: sanitizeHtml 允許 SPA 相對路徑 href（例 `/trip/:id/notes`）
 * 但拒絕 protocol-relative `//evil.com`。
 *
 * Bug 取證（prod QA）：backend AI reply 寫
 *   `AI 生成完成 ...\n\n[前往行程筆記 →](/trip/:id/notes)`
 * markdown 渲染後 `<a href="/trip/:id/notes">前往行程筆記 →</a>`，
 * 但 sanitize line 44 allowed regex 只接受 `https:|tel:|mailto:|#`，相對路徑被
 * strip → 最終 `<a>前往行程筆記 →</a>` 無 href = 不能 click。
 *
 * Fix：allowed regex 加 `|\/(?!\/)` — 允許 `/path` 拒絕 `//host`。
 */
import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from '../../src/lib/sanitize';

describe('v2.31.26 sanitizeHtml href 允許相對路徑', () => {
  it('SPA 相對路徑保留 href', () => {
    const out = sanitizeHtml('<a href="/trip/abc/notes">前往行程筆記</a>');
    expect(out).toMatch(/href="\/trip\/abc\/notes"/);
  });

  it('絕對路徑帶 query / hash 仍保留', () => {
    const out = sanitizeHtml('<a href="/favorites?tab=hotel#top">收藏</a>');
    expect(out).toMatch(/href="\/favorites\?tab=hotel#top"/);
  });

  it('protocol-relative `//evil.com` 仍被 strip（regression — 不能放鬆）', () => {
    const out = sanitizeHtml('<a href="//evil.com/attack">點我</a>');
    expect(out).not.toMatch(/href=/);
  });

  it('javascript: 仍被 strip', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">點我</a>');
    expect(out).not.toMatch(/href=/);
  });

  it('data: 仍被 strip', () => {
    const out = sanitizeHtml('<a href="data:text/html,...">點我</a>');
    expect(out).not.toMatch(/href=/);
  });

  it('https: 仍保留（regression）', () => {
    const out = sanitizeHtml('<a href="https://example.com/page">外部</a>');
    expect(out).toMatch(/href="https:\/\/example\.com\/page"/);
  });

  it('# hash anchor 仍保留（regression）', () => {
    const out = sanitizeHtml('<a href="#section">內部</a>');
    expect(out).toMatch(/href="#section"/);
  });

  it('mailto / tel 仍保留', () => {
    const out1 = sanitizeHtml('<a href="mailto:hi@example.com">email</a>');
    expect(out1).toMatch(/href="mailto:hi@example\.com"/);
    const out2 = sanitizeHtml('<a href="tel:+886912345678">phone</a>');
    expect(out2).toMatch(/href="tel:\+886912345678"/);
  });
});

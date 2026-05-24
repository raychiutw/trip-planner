/**
 * architecture-key-decisions.test.ts — Round 26 (v2.33.76)
 *
 * Round 18 ARCHITECTURE.md doc drift audit + Round 25 follow-up:
 * Key Architectural Decisions section v2.31.x reality 對齊。
 *
 * 過去 v2.21.x V2 OAuth 切換 / v2.23.0 Google Maps 全面切換 / v2.27.0 OCC token
 * 等決策只散在 CHANGELOG，這 section 該是「為什麼」的 single source of truth。
 *
 * 此 test 鎖 source-grep 確保未來 stale 文案不悄悄回來：
 *   - 不該再說 "Cloudflare Access 而非 app-level auth"（已切 V2 OAuth）
 *   - 不該再說 "POI 雙層所有權（pois + trip_pois）"（v2.29.0 已整表 rip-out）
 *   - 必須含 V2 OAuth / Google Maps / OCC 三個關鍵決策
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ARCH = readFileSync(join(process.cwd(), 'ARCHITECTURE.md'), 'utf-8');

// 抽 Key Architectural Decisions section（## Key Architectural Decisions 到下一個 ##）
const SECTION = ARCH.match(/## Key Architectural Decisions\s*\n([\s\S]*?)(?=\n## )/)?.[1] ?? '';

describe('Round 26 — ARCHITECTURE Key Decisions section', () => {
  it('section 存在', () => {
    expect(SECTION).not.toBe('');
    expect(SECTION.length).toBeGreaterThan(500);
  });

  it('不該再說 "Cloudflare Access 而非 app-level auth" 為當前 ADR（v2.21.x V2 OAuth 已切）', () => {
    expect(SECTION).not.toMatch(/Cloudflare Access 而非 app-level auth/);
  });

  it('必須含 V2 OAuth 決策說明', () => {
    expect(SECTION).toMatch(/V2 OAuth/);
  });

  it('不該再講 trip_pois 雙層所有權當「現狀」（v2.29.0 已 rip-out）', () => {
    // 抓「POI 雙層所有權（pois + trip_pois）」這種斷言式描述
    expect(SECTION).not.toMatch(/POI 雙層所有權.*pois \+ trip_pois/);
    // OK if it appears as 歷史 narrative («過去**…», «實測…», «rip-out» 句型)
  });

  it('必須含 multi-POI per entry / trip_entry_pois 當前模型', () => {
    expect(SECTION).toMatch(/trip_entry_pois|多 POI|multi-POI|主選.*備案/);
  });

  it('必須含 Google Maps Platform 切換決策（v2.23.0）', () => {
    expect(SECTION).toMatch(/Google Maps/);
  });

  it('必須含 OCC token 設計 (entry_pois_version) 說明', () => {
    expect(SECTION).toMatch(/OCC|optimistic concurrency|entry_pois_version|STALE_ENTRY/);
  });
});

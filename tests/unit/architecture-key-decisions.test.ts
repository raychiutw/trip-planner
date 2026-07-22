/**
 * architecture-key-decisions.test.ts — Round 26 (v2.33.76)
 *
 * Round 18 ARCHITECTURE.md doc drift audit + Round 25 follow-up:
 * Key Architectural Decisions v2.31.x reality 對齊。
 *
 * 過去 v2.21.x V2 OAuth 切換 / v2.23.0 Google Maps 全面切換 / v2.27.0 OCC token
 * 等決策只散在 CHANGELOG，需要一份「為什麼」的 single source of truth。
 *
 * **v2.57.17 搬遷**：決策本體從 ARCHITECTURE.md 的散文清單搬到 `docs/adr/`
 * （每條一檔、可個別標 superseded），ARCHITECTURE.md 該段改為索引表。
 *
 * 搬遷後若只驗索引表，這支測試會變成「守一張連結表」——
 * 它的斷言剛好因為索引列含有關鍵字而通過，但已不再守決策本體。
 * 那正是 wayfinder #1116 揭露的「測試在說謊」同一類問題，故此處雙向鎖：
 *   1. ARCHITECTURE.md 仍有索引段，且每個 ADR 連結指向真實存在的檔案
 *   2. 決策本體（V2 OAuth / Google Maps / OCC / multi-POI 模型）在 ADR 檔內
 *   3. stale 文案不得回來（Cloudflare Access 當現行 auth、trip_pois 雙層所有權）
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const ARCH = readFileSync(join(ROOT, 'ARCHITECTURE.md'), 'utf-8');

// 抽 Key Architectural Decisions section（## Key Architectural Decisions 到下一個 ##）
const SECTION = ARCH.match(/## Key Architectural Decisions\s*\n([\s\S]*?)(?=\n## )/)?.[1] ?? '';

// ADR 檔（decisions 的本體所在）
const ADR_DIR = join(ROOT, 'docs', 'adr');
const ADR_FILES = existsSync(ADR_DIR)
  ? readdirSync(ADR_DIR).filter((f) => /^\d{4}-.*\.md$/.test(f)).sort()
  : [];
const ADR_TEXT = ADR_FILES.map((f) => readFileSync(join(ADR_DIR, f), 'utf-8')).join('\n');

// 索引表裡的 ADR 連結（docs/adr/xxxx-*.md）
const LINKED = [...SECTION.matchAll(/docs\/adr\/([\w.-]+\.md)/g)].map((m) => m[1]);

describe('ARCHITECTURE Key Decisions — 索引段', () => {
  it('section 存在', () => {
    expect(SECTION).not.toBe('');
  });

  it('索引指向 docs/adr/，而非把決策內文寫回這裡', () => {
    expect(SECTION).toMatch(/docs\/adr\//);
    expect(LINKED.length).toBeGreaterThan(0);
  });

  it('每個索引連結都指向真實存在的 ADR 檔（防連結腐爛）', () => {
    const missing = LINKED.filter((f) => !existsSync(join(ADR_DIR, f)));
    expect(missing).toEqual([]);
  });

  it('每個 ADR 檔都被索引到（防孤兒 ADR）', () => {
    const orphans = ADR_FILES.filter((f) => !LINKED.includes(f));
    expect(orphans).toEqual([]);
  });
});

describe('ADR 本體 — 關鍵決策必須在檔案裡（不是只在索引標題）', () => {
  it('至少有一份 ADR', () => {
    expect(ADR_FILES.length).toBeGreaterThan(0);
  });

  it('必須含 V2 OAuth 決策說明', () => {
    expect(ADR_TEXT).toMatch(/V2 OAuth/);
  });

  it('必須含 Google Maps Platform 切換決策（v2.23.0）', () => {
    expect(ADR_TEXT).toMatch(/Google Maps/);
  });

  it('必須含 OCC token 設計 (entry_pois_version) 說明', () => {
    expect(ADR_TEXT).toMatch(/OCC|optimistic concurrency|entry_pois_version|STALE_ENTRY/);
  });

  it('必須含 multi-POI per entry / trip_entry_pois 當前模型', () => {
    expect(ADR_TEXT).toMatch(/trip_entry_pois|多 POI|multi-POI|正選.*備選|主選.*備案/);
  });

  it('ADR 有 Status 欄（可個別標記 superseded — 這是搬離散文清單的理由）', () => {
    for (const f of ADR_FILES) {
      const body = readFileSync(join(ADR_DIR, f), 'utf-8');
      expect(body, `${f} 缺 Status`).toMatch(/\*\*Status\*\*/);
    }
  });
});

describe('stale 文案不得回來（ARCHITECTURE.md 與 ADR 皆檢）', () => {
  const ALL = `${SECTION}\n${ADR_TEXT}`;

  it('不該再說 "Cloudflare Access 而非 app-level auth"（v2.21.x 已切 V2 OAuth）', () => {
    expect(ALL).not.toMatch(/Cloudflare Access 而非 app-level auth/);
  });

  it('不該再講 trip_pois 雙層所有權當「現狀」（v2.29.0 已 rip-out）', () => {
    // 抓「POI 雙層所有權（pois + trip_pois）」這種斷言式描述。
    // 以歷史敘述出現（「過去…」「實測…」「rip-out」句型）是允許的。
    expect(ALL).not.toMatch(/POI 雙層所有權.*pois \+ trip_pois/);
  });
});

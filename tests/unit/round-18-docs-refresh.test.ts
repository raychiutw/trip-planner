/**
 * round-18-docs-refresh.test.ts — v2.33.68 docs review (Round 18)
 *
 * Round 18 docs review 找 5 CRITICAL + 5 MED + 5 LOW finding。
 * 本 PR 處理大部分 actionable。此 test 鎖住 main fix 不被回退。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const read = (p: string) => readFileSync(path.resolve(__dirname, '../..', p), 'utf-8');
const exists = (p: string) => existsSync(path.resolve(__dirname, '../..', p));

const README = read('README.md');
const ARCHITECTURE = read('ARCHITECTURE.md');
const CONTRIBUTING = read('CONTRIBUTING.md');
const AGENTS = read('AGENTS.md');
const GEMINI = read('GEMINI.md');
const SPEC = read('SPEC.md');
const CR_README = read('docs/code-review/README.md');

describe('v2.33.68 #1 — README.md 移除 stale OSM/ORS/Haversine 描述', () => {
  it('改為 Google Maps Platform', () => {
    expect(README).not.toMatch(/Nominatim \+ Overpass \+ OpenTripMap \+ Wikidata/);
    expect(README).not.toMatch(/ORS 路徑.*Haversine fallback/);
    expect(README).toMatch(/Google Places 自動補資料|Google Routes API/);
  });

  it('removed broken screenshot ref', () => {
    expect(README).not.toMatch(/daily-report-flow\.png/);
  });

  it('mentions trip_entry_pois (v2.27.0+) not trip_pois 覆寫', () => {
    expect(README).toMatch(/trip_entry_pois/);
    expect(README).not.toMatch(/trip_pois.*允許 user 覆寫/);
  });
});

describe('v2.33.68 #2 — ARCHITECTURE.md V2 OAuth + Google Maps refresh', () => {
  it('Auth row 改 V2 OAuth (不再 Cloudflare Access)', () => {
    expect(ARCHITECTURE).toMatch(/V2 OAuth.*tripline_session/);
    expect(ARCHITECTURE).not.toMatch(/^\| Auth \| Cloudflare Access.*JWT cookie/m);
  });

  it('Auth section 改 V2 OAuth + .dev.vars (不再 .env.local + CF Access)', () => {
    expect(ARCHITECTURE).toMatch(/\.dev\.vars/);
    expect(ARCHITECTURE).toMatch(/V2 OAuth session/);
  });

  it('POI 模型描述 v2.27/v2.29 後狀態 (trip_entry_pois junction)', () => {
    expect(ARCHITECTURE).toMatch(/trip_entry_pois.*junction/);
    expect(ARCHITECTURE).toMatch(/已 DROP/);
  });

  it('Maps stack 改 Google (OSM stack 全標為 ripped out)', () => {
    expect(ARCHITECTURE).toMatch(/Google Maps Platform stack/);
    expect(ARCHITECTURE).toMatch(/全 ripped out/);
  });
});

describe('v2.33.68 #3 — CONTRIBUTING.md .dev.vars + bun + Node 22', () => {
  it('Prerequisites Node 22+', () => {
    expect(CONTRIBUTING).toMatch(/Node\.js.*22\+/);
  });

  it('Prerequisites 加 bun', () => {
    expect(CONTRIBUTING).toMatch(/bun.*google-poi-/);
  });

  it('.env.local → .dev.vars', () => {
    expect(CONTRIBUTING).toMatch(/\.dev\.vars/);
    expect(CONTRIBUTING).not.toMatch(/建一份 `\.env\.local`/);
  });

  it('trip_pois 改 trip_entry_pois', () => {
    expect(CONTRIBUTING).toMatch(/trip_entry_pois|trip_pois 已 DROP/);
  });
});

describe('v2.33.68 #4 — AGENTS.md sync from CLAUDE.md', () => {
  it('Hard Rules 加 Mockup-first hard gate', () => {
    expect(AGENTS).toMatch(/Mockup-first hard gate/);
    expect(AGENTS).toMatch(/Code change.*tp-team.*first/);
  });

  it('加 Naming history summary', () => {
    expect(AGENTS).toMatch(/Naming history/);
    expect(AGENTS).toMatch(/v2\.23\.0\+.*Google Maps Platform/);
  });

  it('typo `.Codex` → `.claude` 修正', () => {
    expect(AGENTS).not.toMatch(/\.Codex\/skills/);
    expect(AGENTS).toMatch(/\.claude\/skills/);
  });
});

describe('v2.33.68 #5 — GEMINI.md trip_pois 移除', () => {
  it('改為 trip_entry_pois junction (v2.29.0 後 trip_pois 已 DROP)', () => {
    expect(GEMINI).toMatch(/trip_entry_pois/);
    expect(GEMINI).toMatch(/trip_pois.*DROP/);
  });
});

describe('v2.33.68 #6 — SPEC.md mark SUPERSEDED', () => {
  it('Status SUPERSEDED + 不要 follow warning', () => {
    expect(SPEC).toMatch(/SUPERSEDED/);
    expect(SPEC).toMatch(/不要 follow 本檔做 implementation/);
  });
});

describe('v2.33.68 #7 — docs/code-review/README.md 完整 + PR 號 backfill', () => {
  it('Round 13 PR URL 修 typo (planner → trip-planner)', () => {
    expect(CR_README).toMatch(/raychiutw\/trip-planner\/pull\/739/);
    expect(CR_README).not.toMatch(/raychiutw\/planner\/pull\/739/);
  });

  it('Round 14b/14c/14d/15a/15b/16/17 都 listed + 有 PR #', () => {
    expect(CR_README).toMatch(/\| 14b \|.*#741/);
    expect(CR_README).toMatch(/\| 14c \|.*#742/);
    expect(CR_README).toMatch(/\| 14d \|.*#743/);
    expect(CR_README).toMatch(/\| 15a \|.*#744/);
    expect(CR_README).toMatch(/\| 15b \|.*#745/);
    expect(CR_README).toMatch(/\| 16 \|.*#746/);
    expect(CR_README).toMatch(/\| 17 \|.*#755/);
  });
});

describe('v2.33.68 #8 — optimization-report 移到 docs/archive', () => {
  it('docs/archive/optimization-report-2026-03-22.md exists', () => {
    expect(exists('docs/archive/optimization-report-2026-03-22.md')).toBe(true);
  });

  it('root optimization-report 不再存在', () => {
    expect(exists('optimization-report-2026-03-22.md')).toBe(false);
  });
});

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

const ARCHITECTURE = read('ARCHITECTURE.md');
const CONTRIBUTING = read('CONTRIBUTING.md');
const AGENTS = read('AGENTS.md');
const GEMINI = read('GEMINI.md');
const SPEC = read('SPEC.md');

// v2.33.68 #1（README 不得出現 OSM/ORS 舊描述）已退役：README 改為產品介紹，不再有技術段落，連結與截圖契約改由 readme-product.test.ts 守。
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

describe('AGENTS.md workflow', () => {
  it('uses the official Matt Pocock chain and keeps the Mockup-first hard gate', () => {
    expect(AGENTS).toMatch(/Mockup-first hard gate/);
    expect(AGENTS).toMatch(/grill-with-docs.*to-spec.*to-tickets.*implement.*code-review/s);
    expect(AGENTS).toMatch(/Do not invoke `\/tp-team`/);
  });

  it('加 Naming history summary', () => {
    expect(AGENTS).toMatch(/Naming history/);
    expect(AGENTS).toMatch(/v2\.23\.0\+.*Google Maps Platform/);
  });

  it('points to the installed Matt Pocock skills directory', () => {
    expect(AGENTS).not.toMatch(/\.Codex\/skills/);
    expect(AGENTS).toMatch(/~\/\.agents\/skills/);
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

/**
 * Regression locks for the v2.44.x audit high-severity bug-fix batch.
 *
 * Behavioral where cheap (cache datetime format; /api/route 的 429 enforcement 在
 * tests/api/route-audit-fixes.integration.test.ts 走 HTTP)；source-level for the rest
 * (each lock pins the exact fix so it can't silently regress). One block per finding.
 */
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readTimelineRailSources } from './__helpers__/railSources';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');


// ---- maps/cache expires_at must be SQLite-native (space, not ISO 'T') ----

// ---- Source-level locks for the remaining fixes ----
describe('audit fix source locks', () => {


  it('EntryActionPage move action sends snake_case day_id', () => {
    // #1261：move 的 body 由 entry 變更 module 組（moveEntry → { day_id }），頁面只呼叫動詞。
    const page = read('src/pages/EntryActionPage.tsx');
    expect(page).toMatch(/moveEntry\(tripId, entryIdNum/);
    const mod = read('src/lib/entryMutations.ts');
    expect(mod).toMatch(/\{ day_id: to\.toDayId \}/);
    expect(mod).not.toMatch(/\{ dayId:/);
  });



  it('TripNotesPage accordion header: toggle <button> 與 AI <button> 是兄弟（#1587 21，不再 div[role=button] 內含 button）', () => {
    const src = read('src/pages/TripNotesPage.tsx');
    expect(src).not.toMatch(/role="button"\s+tabIndex=\{0\}\s+className="tp-notes-section-head"/);
    expect(src).toMatch(/<div className="tp-notes-section-head">\s*<button\s+type="button"\s+className="tp-notes-section-toggle"/);
  });

});

// ---- Medium-tier audit fixes (v2.45.x) ----
describe('audit fix source locks — medium tier', () => {
  it('nav active patterns（sub-routes + stop/map active）— navItems 單一來源', () => {
    // rev2 §10.1（2026-07-19）：primary IA + active patterns 抽到 navItems.ts，
    // GlobalBottomNav（手機膠囊）+ DesktopSidebar（桌機 sidebar）共用同一份、無漂移。
    const nav = read('src/components/shell/navItems.ts');
    // 行程 pattern excludes map + stop/map; map pattern covers both map routes
    expect(nav).toContain('/^\\/trip\\/[^/]+(?:\\/?$|\\/(?!(?:map|stop\\/[^/]+\\/map)\\/?$).*)/');
    expect(nav).toMatch(/stop\\\/\[\^\/\]\+\\\/map\\\/\?\$/); // MAP pattern now includes stop/:id/map
  });


  it('functions/trip OG title falls back title || name || 行程', () => {
    expect(read('functions/trip/[[path]].ts')).toMatch(/trip\.title \|\| trip\.name \|\| '行程'/);
  });

  it('ShareLinkModal expiry pre-fill uses local date getters (not UTC toISOString)', () => {
    const src = read('src/components/share/ShareLinkModal.tsx');
    expect(src).toMatch(/customDate: l\.expiresAt == null \? '' : \(\(\) => \{ const d = new Date\(l\.expiresAt\)/);
    expect(src).not.toMatch(/customDate: l\.expiresAt == null \? '' : new Date\(l\.expiresAt\)\.toISOString/);
  });



});

// ---- Medium+low audit fixes (batch 3) ----
describe('audit fix source locks — batch 3', () => {
  // #1257：add-to-trip 的 append / insert-before 改由 entry intake 承載，
  // tests/api/entry-intake.integration.test.ts「insert-before 讓位」走行為驗證。



  it('AlertPanel is-warning uses design tokens (dark-mode adaptive), not hardcoded rgb', () => {
    const src = read('src/components/shared/AlertPanel.tsx');
    expect(src).toMatch(/\.tp-alert-panel\.is-warning \{[\s\S]*var\(--color-warning-bg\)/);
    expect(src).not.toMatch(/border-color: rgb\(244, 140, 6\)/);
  });



});

// ---- Partial-tier hardening fixes ----
describe('audit fix source locks — partial hardening', () => {
  it('TimelineRail drag fallback id uses positional index (no null-id collision)', () => {
    const src = readTimelineRailSources();
    expect(src).toMatch(/findIndex\(\(ev, i\) => \(ev\.id \?\? `idx-\$\{i\}`\)/);
    expect(src).not.toMatch(/findIndex\(\(ev\) => \(ev\.id \?\? `idx-\$\{ev\.id\}`\)/);
  });




});

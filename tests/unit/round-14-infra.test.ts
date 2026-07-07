/**
 * round-14-infra.test.ts — v2.33.60 Round 14 frontend infra + security guard
 *
 * Source-grep guard for 9 fix:
 *   1. _headers CSP narrow + global security headers (Referrer-Policy / COOP / nosniff)
 *   2. index.html theme-color sync to manifest #F47B5E
 *   3. vite.config 拔 leaflet optimizeDeps + 補 manualChunks
 *   4. _routes.json 加 /og/* exclude
 *   5. manifest scope/id/lang/description + icon purpose
 *   6. wrangler.toml [env.production.vars] ENVIRONMENT
 *   7. tsconfig.functions exclude
 *   8. tokens.css warning hue 對齊 (orange family) + toast border color-mix
 *   9. auth-cleanup.js 4 個新 retention sweep
 *  10. migration 0069 trip_health_reports FK + 0070 sqlite_sequence fix
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (p: string) => readFileSync(path.resolve(__dirname, '../..', p), 'utf-8');

const HEADERS = read('public/_headers');
const INDEX_HTML = read('index.html');
const VITE_CONFIG = read('vite.config.ts');
const ROUTES_JSON = read('public/_routes.json');
const MANIFEST = JSON.parse(read('public/manifest.json'));
const WRANGLER = read('wrangler.toml');
const TSCONFIG_FN = JSON.parse(read('tsconfig.functions.json'));
const TOKENS_CSS = read('css/tokens.css');
const AUTH_CLEANUP = read('scripts/auth-cleanup.js');
const MIG_0069 = read('migrations/0069_trip_health_reports_fk.sql');
const MIG_0070 = read('migrations/0070_fix_0047_sqlite_sequence.sql');

describe('v2.33.60 #1 — _headers CSP tighten + global security headers', () => {
  it('CSP narrow connect-src to exact Google subdomains (拔 *.googleapis.com 過寬)', () => {
    expect(HEADERS).toContain('https://maps.googleapis.com https://places.googleapis.com https://routes.googleapis.com');
    expect(HEADERS).not.toMatch(/connect-src[^;]*\*\.googleapis\.com/);
  });

  it('CSP img-src 縮為 self + data + Google CDN (拔 https: wildcard)', () => {
    expect(HEADERS).toMatch(/img-src 'self' data: https:\/\/maps\.gstatic\.com/);
    expect(HEADERS).not.toMatch(/img-src 'self' https: data:/);
  });

  it('CSP 加 frame-ancestors / object-src / upgrade-insecure-requests', () => {
    expect(HEADERS).toMatch(/frame-ancestors 'none'/);
    expect(HEADERS).toMatch(/object-src 'none'/);
    expect(HEADERS).toMatch(/upgrade-insecure-requests/);
  });

  it('global nosniff + Referrer-Policy + COOP', () => {
    expect(HEADERS).toMatch(/^\s*X-Content-Type-Options: nosniff/m);
    expect(HEADERS).toMatch(/Referrer-Policy: strict-origin-when-cross-origin/);
    expect(HEADERS).toMatch(/Cross-Origin-Opener-Policy: same-origin/);
  });
});

describe('v2.33.60 #2 — index.html theme-color sync', () => {
  it('theme-color 對齊 manifest terracotta (#F47B5E)', () => {
    expect(INDEX_HTML).toMatch(/theme-color["']\s*content=["']#F47B5E/);
    // 不允許 active meta tag 仍用舊 ocean blue (comment 提到無妨)
    expect(INDEX_HTML).not.toMatch(/content=["']#0077B6/);
  });

  it('manifest theme_color 仍是 #F47B5E', () => {
    expect(MANIFEST.theme_color).toBe('#F47B5E');
  });
});

describe('v2.33.60 #3 — vite.config', () => {
  it('拔 leaflet optimizeDeps (v2.23.0 已切 Google Maps)', () => {
    // active config 不該有 optimizeDeps include leaflet (comment 提及 'leaflet' 可)
    expect(VITE_CONFIG).not.toMatch(/include:\s*\[['"]leaflet['"]/);
  });

  it('manualChunks 補 heavy deps (gmaps / headlessui / dndkit / pdf / marked)', () => {
    expect(VITE_CONFIG).toContain("return 'gmaps'");
    expect(VITE_CONFIG).toContain("return 'headlessui'");
    expect(VITE_CONFIG).toContain("return 'dndkit'");
    expect(VITE_CONFIG).toContain("return 'pdf'");
    expect(VITE_CONFIG).toContain("return 'pdf-jspdf'");
    expect(VITE_CONFIG).toContain("return 'pdf-html2canvas'");
    expect(VITE_CONFIG).toContain("return 'pdf-dompurify'");
    expect(VITE_CONFIG).toContain("return 'marked'");
  });

  it('PDF export 使用 source alias + explicit async chunk warning budget', () => {
    expect(VITE_CONFIG).toContain("find: 'html2pdf.js'");
    expect(VITE_CONFIG).toContain('node_modules/html2pdf.js/src/index.js');
    expect(VITE_CONFIG).toMatch(/chunkSizeWarningLimit:\s*700/);
  });
});

describe('v2.33.60 #4 — _routes.json /og/* exclude', () => {
  it('exclude 加 /og/* (避免 CF Function cold-start)', () => {
    expect(JSON.parse(ROUTES_JSON).exclude).toContain('/og/*');
  });
});

describe('v2.33.60 #5 — manifest scope/id/lang/description', () => {
  it('id + scope + start_url 對齊 (PWA identity)', () => {
    expect(MANIFEST.id).toBe('/');
    expect(MANIFEST.scope).toBe('/');
    expect(MANIFEST.start_url).toBe('/');
  });

  it('lang + description 補齊', () => {
    expect(MANIFEST.lang).toBe('zh-TW');
    expect(typeof MANIFEST.description).toBe('string');
    expect((MANIFEST.description as string).length).toBeGreaterThan(10);
  });

  it('icons 明示 purpose', () => {
    for (const icon of MANIFEST.icons) {
      expect(icon.purpose).toBeDefined();
    }
  });
});

describe('v2.33.60 #6 — wrangler.toml prod env', () => {
  it('[env.production.vars] ENVIRONMENT = "production"', () => {
    expect(WRANGLER).toMatch(/\[env\.production\.vars\]\s*\nENVIRONMENT\s*=\s*"production"/);
  });
});

describe('v2.33.60 #7 — tsconfig.functions exclude', () => {
  it('exclude 加 node_modules / dist', () => {
    expect(TSCONFIG_FN.exclude).toContain('node_modules');
    expect(TSCONFIG_FN.exclude).toContain('dist');
  });
});

describe('v2.33.60 #8 — tokens.css warning hue + toast border color-mix', () => {
  it('dark mode --color-warning 維持 orange family (拔 yellow #F0D060)', () => {
    expect(TOKENS_CSS).not.toMatch(/--color-warning:\s*#F0D060/);
    expect(TOKENS_CSS).toMatch(/--color-warning:\s*#FAA94B/);
  });

  it('toast border 改 color-mix (dark mode 跟 token 變色)', () => {
    expect(TOKENS_CSS).toMatch(/\.tp-toast--error \{\s*border-color: color-mix\(in srgb, var\(--color-destructive\)/);
    expect(TOKENS_CSS).toMatch(/\.tp-toast--success \{\s*border-color: color-mix\(in srgb, var\(--color-success\)/);
    expect(TOKENS_CSS).toMatch(/\.tp-toast--warning \{\s*border-color: color-mix\(in srgb, var\(--color-warning\)/);
    expect(TOKENS_CSS).toMatch(/\.tp-toast--info \{\s*border-color: color-mix\(in srgb, var\(--color-info\)/);
  });

  it('toast border 拔掉寫死 rgba()', () => {
    expect(TOKENS_CSS).not.toMatch(/\.tp-toast--error \{ border-color: rgba\(193/);
    expect(TOKENS_CSS).not.toMatch(/\.tp-toast--warning \{ border-color: rgba\(244/);
  });
});

describe('v2.33.60 #9 — auth-cleanup.js 4 個新 retention sweep', () => {
  it('trip_invitations 加 sweep (accepted 90d / expired 30d)', () => {
    expect(AUTH_CLEANUP).toContain('trip_invitations');
    expect(AUTH_CLEANUP).toMatch(/expires_at < datetime\('now', '-30 days'\)/);
  });

  it('pois_search_cache 加 sweep (expires_at < now)', () => {
    expect(AUTH_CLEANUP).toContain('pois_search_cache');
    expect(AUTH_CLEANUP).toMatch(/pois_search_cache WHERE expires_at < datetime\('now'\)/);
  });

  it('companion_request_actions + error_reports 90d sweep', () => {
    expect(AUTH_CLEANUP).toContain('companion_request_actions');
    expect(AUTH_CLEANUP).toContain('error_reports');
    expect(AUTH_CLEANUP).toMatch(/error_reports WHERE created_at < datetime\('now', '-90 days'\)/);
  });
});

describe('v2.33.60 #10 — migration 0069 + 0070', () => {
  it('0069 trip_health_reports FK on user_id / request_id', () => {
    expect(MIG_0069).toContain('REFERENCES users(id) ON DELETE CASCADE');
    expect(MIG_0069).toContain('REFERENCES trip_requests(id) ON DELETE SET NULL');
  });

  it('0069 用 swap pattern + INNER JOIN users guard', () => {
    expect(MIG_0069).toContain('trip_health_reports_new');
    expect(MIG_0069).toContain('INNER JOIN users');
    expect(MIG_0069).toContain('ALTER TABLE trip_health_reports_new RENAME TO trip_health_reports');
  });

  it('0070 sqlite_sequence INSERT OR REPLACE 5 個 AUTOINCREMENT table', () => {
    expect(MIG_0070).toMatch(/INSERT OR REPLACE INTO sqlite_sequence/);
    const matches = MIG_0070.match(/INSERT OR REPLACE INTO sqlite_sequence/g) ?? [];
    expect(matches.length).toBe(5); // trip_days/trip_entries/trip_destinations/trip_docs/trip_doc_entries
  });

  it('0070 INSERT 不引用 trip_pois (已 DROP 0062) 或 trip_invitations (無 AUTOINCREMENT)', () => {
    // SELECT 'name' lines 中不能含 trip_pois / trip_invitations (comment 提及無妨)
    expect(MIG_0070).not.toMatch(/SELECT 'trip_pois'/);
    expect(MIG_0070).not.toMatch(/SELECT 'trip_invitations'/);
  });
});

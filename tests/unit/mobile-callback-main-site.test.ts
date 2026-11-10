/**
 * mobile OAuth callback 搬到 web 主站（#1482）的 CI 守門：AASA／assetlinks 結構、_headers、路徑不與 SPA 衝突、
 * 以及「原始碼不得新增對舊 mobile-callback 主機的引用」。實機的 Universal Link／App Link 擁有權驗證 CI 做不到，不在此宣稱。
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf-8');
const NEW_PATHS = ['/mobile/oauth/callback', '/mobile/uat/oauth/callback'];

describe('apple-app-site-association', () => {
  const aasa = JSON.parse(read('public/.well-known/apple-app-site-association'));
  const detail = aasa.applinks.details[0];

  it('applinks 精確列出新 callback 與分享連結，沒有 wildcard 之外的萬用路徑', () => {
    expect(aasa.applinks.details).toHaveLength(1);
    expect(detail.appID).toBe('8Z6WVFJ574.com.raychiu.tripline');
    expect(detail.paths).toEqual([...NEW_PATHS, '/s/*']);
  });
  it('webcredentials 保留（iOS 17.4+ 用 https callback 的 ASWebAuthenticationSession 需要）', () => {
    expect(aasa.webcredentials.apps).toEqual([detail.appID]);
  });
});

describe('assetlinks.json', () => {
  const links = JSON.parse(read('public/.well-known/assetlinks.json'));
  it('單一 android_app 目標，package 與 SHA-256 指紋格式正確（Play App Signing，非 upload key）', () => {
    expect(links).toHaveLength(1);
    expect(links[0].relation).toEqual(['delegate_permission/common.handle_all_urls']);
    expect(links[0].target).toMatchObject({ namespace: 'android_app', package_name: 'com.raychiu.tripline' });
    expect(links[0].target.sha256_cert_fingerprints).toEqual([expect.stringMatching(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/)]);
  });
});

describe('public/_headers', () => {
  const headers = read('public/_headers');
  const block = (name: string) => {
    const lines = headers.split('\n');
    const i = lines.findIndex((l) => l === name);
    expect(i, `${name} 區塊存在`).toBeGreaterThanOrEqual(0);
    const body: string[] = [];
    for (const l of lines.slice(i + 1)) { if (/^\S/.test(l)) break; body.push(l.trim()); }
    return { index: headers.indexOf(`\n${name}\n`), body };
  };

  it('AASA（無副檔名）與 assetlinks.json 強制 Content-Type: application/json，且排在全域 /* 之前', () => {
    const global = headers.indexOf('\n/*\n');
    for (const f of ['/.well-known/apple-app-site-association', '/.well-known/assetlinks.json']) {
      const b = block(f);
      expect(b.body).toContain('Content-Type: application/json');
      expect(b.body.some((l) => /^Cache-Control: /.test(l))).toBe(true);
      expect(b.index).toBeLessThan(global);
    }
  });
  it('全域 CSP／安全標頭仍在（新路徑不得讓它們失效）', () => {
    const b = block('/*').body.join('\n');
    for (const h of ['Content-Security-Policy:', 'X-Frame-Options: DENY', 'X-Content-Type-Options: nosniff', 'Strict-Transport-Security:']) expect(b).toContain(h);
  });
});

describe('新 callback 路徑不與 SPA／Functions 衝突', () => {
  it('不在 Functions 路由內（_routes.json include 不涵蓋）→ 走靜態／SPA fallback', () => {
    const { include } = JSON.parse(read('public/_routes.json')) as { include: string[] };
    for (const p of NEW_PATHS) {
      expect(include.some((rule) => rule === p || (rule.endsWith('/*') && p.startsWith(rule.slice(0, -1)))), p).toBe(false);
    }
  });
  it('沒有 _redirects／404.html 會改寫這兩個路徑', () => {
    expect(existsSync(resolve(root, 'public/_redirects'))).toBe(false);
    expect(existsSync(resolve(root, 'public/404.html'))).toBe(false);
  });
  it('SPA 的 <Route path> 沒有任何一條會精確或以 /mobile 前綴吃掉它們（只剩 path="*" 的 LegacyRedirect 兜底）', () => {
    const paths = [...read('src/entries/main.tsx').matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]!);
    expect(paths.length).toBeGreaterThan(10);
    for (const route of paths) {
      if (route === '*') continue;
      const base = route.replace(/\/\*$/, '');
      for (const p of NEW_PATHS) {
        expect(p === route || (route.endsWith('/*') && (p === base || p.startsWith(`${base}/`))), `${route} vs ${p}`).toBe(false);
      }
    }
    expect(paths).toContain('*');
  });
  it('既有的 SPA 回跳路由未動（/oauth/authorize）', () => {
    const src = read('src/entries/main.tsx');
    expect(src).toContain('path="/oauth/authorize"');
  });
});

// 非歷史範圍：程式、設定、範本與現行文件。CHANGELOG、docs/adr、migrations、有日期的研究／QA 文件是歷史紀錄，不掃、不改寫。
const LIVE_SCOPE = ['src', 'functions', 'public', 'scripts', 'wrangler.toml', 'tests', 'CLAUDE.md', 'AGENTS.md', 'README.md', 'CONTRIBUTING.md', 'ARCHITECTURE.md', '.dev.vars.example', '.env.local.example', 'lighthouserc.json'];
const SELF = 'tests/unit/mobile-callback-main-site.test.ts';
// git grep 沒命中會以 1 結束，視為空結果；其他錯誤照拋。
const grepFiles = (pattern: string, scope: string[]) => {
  try {
    return execFileSync('git', ['grep', '--untracked', '-l', '-E', pattern, '--', ...scope], { cwd: root, encoding: 'utf-8' }).split('\n').filter(Boolean).filter((f) => f !== SELF);
  } catch (e) {
    if ((e as { status?: number }).status === 1) return [];
    throw e;
  }
};

describe('grep 守門：舊入口與舊 mobile-callback 主機不得出現（#1663／#1627）', () => {
  it('舊 mobile-callback 主機（含測試 fixture）在非歷史範圍已清空，不再有待清理清單', () => {
    expect(grepFiles('mobile-callback\\.trip-planner-dby\\.pages\\.dev', LIVE_SCOPE)).toEqual([]);
  });
  it('網站網域 trip-planner-dby.pages.dev 上的 /api 不再被當成 API 入口（舊入口已刪，API 在 trip-planner-api）', () => {
    expect(grepFiles('trip-planner-dby\\.pages\\.dev/api', LIVE_SCOPE.filter((p) => p !== 'tests'))).toEqual([]);
  });
  it('已隨舊入口刪除的 mock auth／middleware 說明不得留在現行文件與範本', () => {
    expect(grepFiles('DEV_MOCK_EMAIL|ALLOW_DEV_MOCK|_middleware\\.ts|functions/api', ['CLAUDE.md', 'AGENTS.md', 'README.md', 'CONTRIBUTING.md', '.dev.vars.example', '.env.local.example', 'wrangler.toml'])).toEqual([]);
  });
});

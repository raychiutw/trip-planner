/**
 * sanitize-uri-attrs.test.ts — v2.33.36 security audit round 1
 *
 * 之前 sanitize.ts 只擋 `href|src|action`，漏了 `formaction` / `xlink:href` /
 * `srcset` / `poster` / `background` / `data` 等 URI-bearing attrs。chat AI
 * reply 經 marked.parse() → dangerouslySetInnerHTML 渲染，惡意 markdown 可
 * 用 `<svg><use href="javascript:...">` 或 `<button formaction="javascript:...">`
 * 觸發 XSS 偷 token。
 *
 * 全部 attack vector regression test。
 */
// vitest default environment is jsdom (per vitest.config.js)，內建 DOMParser。
import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from '../../src/lib/sanitize';

describe('sanitizeHtml — URI-bearing attribute allowlist', () => {
  it('strips `formaction` with javascript: payload', () => {
    const html = '<button formaction="javascript:alert(1)">click</button>';
    const out = sanitizeHtml(html);
    expect(out).not.toMatch(/formaction/i);
    expect(out).not.toMatch(/javascript:/i);
  });

  it('strips `srcset` with javascript: payload', () => {
    const html = '<img srcset="javascript:alert(1) 1x" src="ok.jpg">';
    const out = sanitizeHtml(html);
    expect(out).not.toMatch(/srcset/i);
  });

  it('strips `poster` with javascript: payload', () => {
    const html = '<video poster="javascript:alert(1)">x</video>';
    const out = sanitizeHtml(html);
    expect(out).not.toMatch(/poster=/i);
  });

  it('strips `background` / `data` / `ping` / `cite` with javascript: payload', () => {
    const html = [
      '<table background="javascript:1">',
      '<a ping="javascript:1" cite="javascript:1">x</a>',
      '<object data="javascript:1"></object>',
      '</table>',
    ].join('');
    const out = sanitizeHtml(html);
    expect(out).not.toMatch(/background=/i);
    expect(out).not.toMatch(/ping=/i);
    expect(out).not.toMatch(/cite=/i);
    // object tag itself is removed
    expect(out).not.toMatch(/<object/i);
  });

  it('strips entire <svg> tag (eliminates SVG xlink:href attack surface)', () => {
    const html = '<svg><use href="javascript:alert(1)"/></svg>';
    const out = sanitizeHtml(html);
    expect(out).not.toMatch(/<svg/i);
    expect(out).not.toMatch(/<use/i);
  });

  it('strips `style` entirely (clickjacking / CSS exfil 防範)', () => {
    const html = '<div style="position:fixed;top:0;opacity:0">x</div>';
    const out = sanitizeHtml(html);
    expect(out).not.toMatch(/style=/i);
  });

  it('keeps safe href on anchor (regression: v2.31.26 SPA /path)', () => {
    const html = '<a href="/trip/abc/health">go</a>';
    const out = sanitizeHtml(html);
    expect(out).toMatch(/href="\/trip\/abc\/health"/);
  });

  it('blocks protocol-relative href `//evil.com` (regression: v2.31.26)', () => {
    const html = '<a href="//evil.com">x</a>';
    const out = sanitizeHtml(html);
    expect(out).not.toMatch(/href=/i);
  });

  it('strips on* event handlers (regression)', () => {
    const html = '<div onclick="alert(1)" onmouseover="alert(2)">x</div>';
    const out = sanitizeHtml(html);
    expect(out).not.toMatch(/onclick/i);
    expect(out).not.toMatch(/onmouseover/i);
  });

  it('case-insensitive: `OnClick` / `FORMACTION` still stripped', () => {
    const html = '<button OnClick="alert(1)" FORMACTION="javascript:1">x</button>';
    const out = sanitizeHtml(html);
    expect(out).not.toMatch(/onclick/i);
    expect(out).not.toMatch(/formaction/i);
  });

  it('keeps target=_blank but injects rel="noopener noreferrer"', () => {
    const html = '<a href="https://example.com" target="_blank">x</a>';
    const out = sanitizeHtml(html);
    expect(out).toMatch(/rel="noopener noreferrer"/);
  });
});

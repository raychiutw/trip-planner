/**
 * markdown-text-xss.test.tsx — v2.33.44 round 6a critical security test gap
 *
 * MarkdownText 是 chat / AI reply / POI 描述 / 注意事項 等多處 user-content
 * 的 rendering pipeline，用 `dangerouslySetInnerHTML`。XSS regression 已上過
 * 一次（v2.31.26 sanitize SPA path / v2.31.91 link styling / v2.33.36 attr
 * allowlist），但 wiring 本身無 test。本 spec 守 markdown → sanitize → DOM 路
 * 徑端到端不 leak XSS。
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import MarkdownText from '../../src/components/shared/MarkdownText';

describe('MarkdownText — XSS pipeline (markdown → sanitize → DOM)', () => {
  it('strips raw <script> tags from markdown source', () => {
    const { container } = render(
      <MarkdownText text={'before <script>alert(1)</script> after'} />,
    );
    expect(container.innerHTML).not.toMatch(/<script/i);
    expect(container.innerHTML).not.toMatch(/alert\(1\)/);
  });

  it('strips inline event handlers from HTML in markdown', () => {
    const { container } = render(
      <MarkdownText text={'<div onclick="alert(1)">click</div>'} />,
    );
    expect(container.innerHTML).not.toMatch(/onclick/i);
  });

  it('strips <svg><use href=javascript:...> sniper', () => {
    const { container } = render(
      <MarkdownText text={'<svg><use href="javascript:alert(1)"/></svg>'} />,
    );
    expect(container.innerHTML).not.toMatch(/<svg/i);
    expect(container.innerHTML).not.toMatch(/<use/i);
  });

  it('strips <button formaction=javascript:...> (v2.33.36 attr allowlist)', () => {
    const { container } = render(
      <MarkdownText text={'<button formaction="javascript:alert(1)">x</button>'} />,
    );
    expect(container.innerHTML).not.toMatch(/formaction/i);
  });

  it('keeps SPA relative `/path` href (v2.31.26 regression)', () => {
    const { container } = render(
      <MarkdownText text={'[前往行程筆記](/trip/abc/notes)'} />,
    );
    expect(container.innerHTML).toMatch(/href="\/trip\/abc\/notes"/);
  });

  it('blocks protocol-relative `//evil` (regression)', () => {
    const { container } = render(<MarkdownText text={'[bad](//evil.com)'} />);
    expect(container.innerHTML).not.toMatch(/href="\/\/evil/i);
  });

  it('blocks `javascript:` href', () => {
    const { container } = render(
      <MarkdownText text={'[bad](javascript:alert(1))'} />,
    );
    expect(container.innerHTML).not.toMatch(/href="javascript:/i);
  });

  it('renders plain text unchanged (markdown 可能加 <p> wrap)', () => {
    const { container } = render(<MarkdownText text={'plain text'} />);
    // textContent 可能含 trailing newline (block markdown render)，用 trim 比較
    expect(container.textContent?.trim()).toBe('plain text');
  });

  it('inline mode: 不會 wrap <p>（TEL/URL formats 保留）', () => {
    const { container } = render(<MarkdownText text={'+886-2-1234'} inline />);
    expect(container.innerHTML).not.toMatch(/<p>/);
  });

  it('inline mode：仍走 sanitize（XSS guard 不 bypass）', () => {
    const { container } = render(
      <MarkdownText text={'<img src=x onerror=alert(1)>'} inline />,
    );
    expect(container.innerHTML).not.toMatch(/onerror/i);
  });

  it('strip <style> tag (v2.33.36 clickjack 防範)', () => {
    const { container } = render(
      <MarkdownText text={'<div style="position:fixed;opacity:0">x</div>'} />,
    );
    expect(container.innerHTML).not.toMatch(/style=/i);
  });

  it('target=_blank link injects rel="noopener noreferrer"', () => {
    const { container } = render(
      <MarkdownText text={'<a href="https://example.com" target="_blank">x</a>'} />,
    );
    expect(container.innerHTML).toMatch(/rel="noopener noreferrer"/);
  });
});

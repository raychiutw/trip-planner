import { describe, it, expect } from 'vitest';

const { escHtml, escUrl, stripInlineHandlers } = require('../../app.js');

/* ===== escHtml ===== */
describe('escHtml', () => {
  it('returns empty string for null', () => {
    expect(escHtml(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(escHtml(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(escHtml('')).toBe('');
  });

  it('escapes HTML special characters', () => {
    expect(escHtml('<script>"alert&</script>')).toBe(
      '&lt;script&gt;&quot;alert&amp;&lt;/script&gt;'
    );
  });

  it('returns normal string unchanged', () => {
    expect(escHtml('Hello World')).toBe('Hello World');
  });

  it('converts non-string to string', () => {
    expect(escHtml(123)).toBe('123');
  });
});

/* ===== escUrl ===== */
describe('escUrl', () => {
  it('returns empty string for null', () => {
    expect(escUrl(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(escUrl(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(escUrl('')).toBe('');
  });

  it('allows https URLs', () => {
    expect(escUrl('https://example.com')).toBe('https://example.com');
  });

  it('allows http URLs', () => {
    expect(escUrl('http://example.com')).toBe('http://example.com');
  });

  it('allows tel: URLs', () => {
    expect(escUrl('tel:+81-98-123-4567')).toBe('tel:+81-98-123-4567');
  });

  it('blocks javascript: URLs', () => {
    expect(escUrl('javascript:alert(1)')).toBe('');
  });

  it('blocks data: URLs', () => {
    expect(escUrl('data:text/html,<h1>XSS</h1>')).toBe('');
  });

  it('trims whitespace', () => {
    expect(escUrl('  https://example.com  ')).toBe('https://example.com');
  });

  it('blocks relative paths', () => {
    expect(escUrl('/etc/passwd')).toBe('');
  });
});

/* ===== stripInlineHandlers ===== */
describe('stripInlineHandlers', () => {
  it('removes onclick attributes', () => {
    expect(stripInlineHandlers('<div onclick="alert(1)">test</div>')).toBe(
      '<div>test</div>'
    );
  });

  it('preserves non-on attributes', () => {
    const html = '<a href="https://example.com" class="link">test</a>';
    expect(stripInlineHandlers(html)).toBe(html);
  });

  it('removes multiple onclick handlers', () => {
    const input = '<div onclick="a()">1</div><span onclick="b()">2</span>';
    expect(stripInlineHandlers(input)).toBe('<div>1</div><span>2</span>');
  });

  it('handles string with no handlers', () => {
    expect(stripInlineHandlers('plain text')).toBe('plain text');
  });
});

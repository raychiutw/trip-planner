import { describe, it, expect } from 'vitest';

const { escHtml, escUrl, stripInlineHandlers, sanitizeHtml } = require('../../shared.js');
const { safeColor } = require('../../app.js');

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

  it('blocks vbscript: URLs', () => {
    expect(escUrl('vbscript:alert(1)')).toBe('');
  });

  it('blocks JAVASCRIPT: URLs (uppercase)', () => {
    expect(escUrl('JAVASCRIPT:alert(1)')).toBe('');
  });

  it('blocks ftp: URLs', () => {
    expect(escUrl('ftp://example.com')).toBe('');
  });

  it('blocks protocol-relative URLs', () => {
    expect(escUrl('//example.com')).toBe('');
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

  it('removes onerror attributes', () => {
    expect(stripInlineHandlers('<img onerror="alert(1)" src="x">')).toBe(
      '<img src="x">'
    );
  });

  it('removes onload with single quotes', () => {
    expect(stripInlineHandlers("<body onload='init()'>")).toBe('<body>');
  });

  it('removes ONCLICK (uppercase)', () => {
    expect(stripInlineHandlers('<div ONCLICK="alert(1)">test</div>')).toBe(
      '<div>test</div>'
    );
  });

  it('removes onmouseover without quotes', () => {
    expect(stripInlineHandlers('<div onmouseover=alert(1)>test</div>')).toBe(
      '<div>test</div>'
    );
  });
});

/* ===== sanitizeHtml ===== */
describe('sanitizeHtml', () => {
  it('removes <script> tags', () => {
    const result = sanitizeHtml('<p>safe</p><script>alert(1)</script>');
    expect(result).toContain('safe');
    expect(result).not.toContain('script');
    expect(result).not.toContain('alert');
  });

  it('removes <iframe>, <object>, <embed>, <form> tags', () => {
    const result = sanitizeHtml(
      '<p>ok</p><iframe src="x"></iframe><object></object><embed><form action="x"></form>'
    );
    expect(result).toContain('ok');
    expect(result).not.toContain('iframe');
    expect(result).not.toContain('object');
    expect(result).not.toContain('embed');
    expect(result).not.toContain('form');
  });

  it('removes on* event handler attributes', () => {
    const result = sanitizeHtml('<img onerror="alert(1)" src="https://example.com/img.png">');
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('alert');
  });

  it('blocks javascript: href', () => {
    const result = sanitizeHtml('<a href="javascript:alert(1)">click</a>');
    expect(result).toContain('click');
    expect(result).not.toContain('javascript:');
  });

  it('blocks data: URI', () => {
    const result = sanitizeHtml('<a href="data:text/html,<h1>XSS</h1>">link</a>');
    expect(result).not.toContain('data:');
  });

  it('preserves normal https links', () => {
    const result = sanitizeHtml('<a href="https://example.com">link</a>');
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('link');
  });

  it('adds rel="noopener noreferrer" to target="_blank" links', () => {
    const result = sanitizeHtml('<a href="https://example.com" target="_blank">link</a>');
    expect(result).toContain('rel="noopener noreferrer"');
  });

  it('preserves tel: links', () => {
    const result = sanitizeHtml('<a href="tel:+81-98-123">call</a>');
    expect(result).toContain('href="tel:+81-98-123"');
  });

  it('preserves mailto: links', () => {
    const result = sanitizeHtml('<a href="mailto:test@example.com">email</a>');
    expect(result).toContain('href="mailto:test@example.com"');
  });

  it('preserves hash links', () => {
    const result = sanitizeHtml('<a href="#section1">jump</a>');
    expect(result).toContain('href="#section1"');
  });
});

/* ===== safeColor ===== */
describe('safeColor', () => {
  it('allows hex colors', () => {
    expect(safeColor('#e3f2fd')).toBe('#e3f2fd');
    expect(safeColor('#fff')).toBe('#fff');
  });

  it('allows rgb() colors', () => {
    expect(safeColor('rgb(255, 0, 0)')).toBe('rgb(255, 0, 0)');
  });

  it('allows CSS var() colors', () => {
    expect(safeColor('var(--blue-light)')).toBe('var(--blue-light)');
  });

  it('allows named colors', () => {
    expect(safeColor('red')).toBe('red');
  });

  it('falls back for CSS injection', () => {
    expect(safeColor('red;} body{display:none')).toBe('var(--blue-light)');
  });

  it('falls back for null/undefined', () => {
    expect(safeColor(null)).toBe('var(--blue-light)');
    expect(safeColor(undefined)).toBe('var(--blue-light)');
  });
});

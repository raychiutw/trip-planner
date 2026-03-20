/**
 * Escapes a value for safe insertion into HTML text content or attribute values.
 * Returns an empty string for falsy input.
 */
export function escHtml(s: unknown): string {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Validates a URL and returns it only if it starts with `https?:` or `tel:`.
 * Returns an empty string for unsafe or missing values.
 */
export function escUrl(url: unknown): string {
  if (!url) return '';
  const s = String(url).trim();
  if (/^(https?:|tel:)/i.test(s)) return s;
  return '';
}

/**
 * Sanitizes an HTML string by:
 * - Removing dangerous tags (script, iframe, object, embed, form)
 * - Stripping all `on*` event-handler attributes
 * - Stripping unsafe `href`, `src`, and `action` values
 * - Adding `rel="noopener noreferrer"` to `<a target="_blank">` elements
 *
 * Requires a browser `DOMParser` environment.
 */
export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,iframe,object,embed,form').forEach((el) => {
    el.remove();
  });
  doc.querySelectorAll('*').forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      if (attr.name.indexOf('on') === 0) {
        el.removeAttribute(attr.name);
      }
      if (attr.name === 'style') {
        const val = attr.value.toLowerCase();
        // Remove styles that could execute JS or load external resources
        if (/expression\s*\(|javascript:|url\s*\(|@import|behavior\s*:|binding\s*:|-moz-binding/i.test(val)) {
          el.removeAttribute(attr.name);
        }
      }
      if (
        attr.name === 'href' ||
        attr.name === 'src' ||
        attr.name === 'action'
      ) {
        const val = (attr.value || '').trim().toLowerCase();
        if (val && !/^(https?:|tel:|mailto:|#)/.test(val)) {
          el.removeAttribute(attr.name);
        }
      }
    });
    if (
      el.tagName === 'A' &&
      (el as HTMLAnchorElement).getAttribute('target') === '_blank'
    ) {
      el.setAttribute('rel', 'noopener noreferrer');
    }
  });
  return (doc.body as HTMLElement).innerHTML;
}

/**
 * Removes inline event-handler attributes from an HTML string using a regex.
 * Lighter-weight alternative to `sanitizeHtml` when DOM parsing is unavailable.
 */
export function stripInlineHandlers(html: string): string {
  return html.replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, '');
}

/**
 * Renders a text field that may contain markdown to sanitized HTML.
 * Safe for `dangerouslySetInnerHTML` — runs marked.parse() then sanitizeHtml().
 * Pure text passes through unchanged (marked doesn't alter plain text).
 */
import { marked } from 'marked';

export function renderMarkdown(text: string): string {
  return sanitizeHtml(marked.parse(text) as string);
}

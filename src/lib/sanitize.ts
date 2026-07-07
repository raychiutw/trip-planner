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
 * URI-bearing HTML attributes — any of these can carry a URL/script payload and
 * must be allowlist-checked. v2.33.36 security review (round 1): added
 * `formaction` / `xlink:href` / `srcset` / `poster` / `background` / `data` /
 * `ping` / `cite` after audit found the old `href|src|action` set missed
 * SVG `<use href>`, button override `formaction`, and `srcset`/`poster` sinks.
 */
const URI_ATTRS = new Set([
  'href', 'src', 'action',
  'formaction', 'xlink:href',
  'srcset', 'poster', 'background', 'data', 'ping', 'cite',
]);

/**
 * Sanitizes an HTML string by:
 * - Removing dangerous tags (script, iframe, object, embed, form, svg)
 * - Stripping all `on*` event-handler attributes
 * - Stripping `style` attributes entirely (clickjacking / CSS exfil防範)
 * - Stripping unsafe URL-bearing attributes
 * - Adding `rel="noopener noreferrer"` to `<a target="_blank">` elements
 *
 * Requires a browser `DOMParser` environment.
 */
export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,iframe,object,embed,form,svg').forEach((el) => {
    el.remove();
  });
  doc.querySelectorAll('*').forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      const name = attr.name;
      const lowerName = name.toLowerCase();
      if (lowerName.indexOf('on') === 0) {
        el.removeAttribute(name);
        return;
      }
      // v2.33.36: 移掉所有 `style`（含 `position:fixed`/`opacity:0` 的 clickjack
      // 風險、`content:` 屬性選擇器 exfil）。chat / AI reply markdown 不需要 style。
      if (lowerName === 'style') {
        el.removeAttribute(name);
        return;
      }
      if (URI_ATTRS.has(lowerName)) {
        const val = (attr.value || '').trim().toLowerCase();
        // v2.31.26 fix #127: 加 `/(?!\/)` 允許 SPA 相對路徑（例 `/trip/:id/notes`），
        // 但拒絕 protocol-relative URL `//evil.com`（會打到不同 host）。
        // 之前 backend AI reply 寫 markdown link 但 href 被 strip → `<a>` 無法 click。
        if (val && !/^(https?:|tel:|mailto:|#|\/(?!\/))/.test(val)) {
          el.removeAttribute(name);
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
 * Renders a text field that may contain markdown to sanitized HTML.
 * Safe for `dangerouslySetInnerHTML` — runs marked.parse() then sanitizeHtml().
 * Pure text passes through unchanged (marked doesn't alter plain text).
 */
import { marked } from 'marked';

/**
 * Defensive normalization for AI-generated reply payloads:
 * - `\\n` (literal backslash-n from double-encoded JSON) → real newline
 * - solo `~` (e.g., `Day 3~4`, `¥100~300`) → escaped `\~` so marked GFM
 *   strikethrough only fires on the canonical `~~text~~` form. Without this,
 *   a range like `Day 3~4 ... ¥100~300` becomes a giant <del> span.
 */
function normalizeForMarkdown(text: string): string {
  return text
    .replace(/\\n/g, '\n')
    .replace(/(?<!~)~(?!~)/g, '\\~');
}

export function renderMarkdown(text: string): string {
  return sanitizeHtml(marked.parse(normalizeForMarkdown(text)) as string);
}

/**
 * Renders inline markdown (no block-level <p> wrapping).
 * Use for fields that contain TEL/URL/address — marked.parse() would
 * wrap them in <p> and break formatting. marked.parseInline() preserves
 * line breaks as \n which we convert to <br>.
 */
export function renderMarkdownInline(text: string): string {
  const html = (marked.parseInline(normalizeForMarkdown(text)) as string).replace(/\n/g, '<br>');
  return sanitizeHtml(html);
}

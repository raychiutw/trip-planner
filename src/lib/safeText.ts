/**
 * safeText — API shape adapter
 *
 * 接 string / number / 物件 {label, text} / {text} / {name} 等不同形態的 user content。
 * silent fall-through 到 String(value) 會 render `[object Object]`，unit test
 * (tests/unit/infobox-safetext.test.ts) 守每個 branch。
 */
export function safeText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj.label === 'string' && typeof obj.text === 'string') return `${obj.label}: ${obj.text}`;
    if (typeof obj.text === 'string') return obj.text;
    if (typeof obj.name === 'string') return obj.name;
  }
  return String(value);
}

/** WCAG 2.x 對比計算與「從 CSS 字串取單一規則」的共用 helper（測試用）。 */

export function luminance(hex: string): number {
  const n = hex.replace('#', '');
  const f = n.length === 3 ? n.split('').map((c) => c + c).join('') : n;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** 取某條 CSS 規則（單一選擇器）大括號內的宣告；找不到就丟錯，避免守衛因選擇器改名而靜默失效。 */
export function cssRule(css: string, selector: string): string {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = css.match(new RegExp(`(?:^|\\n|\\})\\s*${esc}\\s*\\{([^}]*)\\}`));
  if (!m) throw new Error(`找不到規則 ${selector} — 選擇器改名了？守衛不可靜默失效`);
  return m[1];
}

export const stripCssComments = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Pages Function: /s/:token — 公開分享頁的動態 OG meta 注入（v2.42.0 B1）。
 *
 * 鏡射 functions/trip/[[path]].ts：取 SPA index.html，用 HTMLRewriter 把該分享連結的
 * 行程名 / 日期 / 目的地注入 og/twitter meta，讓貼到 LINE/Messenger/Slack 時有像樣的
 * 連結預覽（crawler 不跑 JS，純靠 server 注入的 <head> meta）。瀏覽器照常載入 SPA →
 * TripSharePage。
 *
 * 安全：只查「永遠公開」的行程名/日期/目的地（不碰 owner PII、不碰筆記區塊）。token
 * 無效/已關閉/已過期 → 直接回原始 shell（通用 OG），由 React 顯示「連結已失效」；任何
 * 錯誤都 fall through 回 shell，絕不讓 /s/:token 整頁壞掉。
 */
import type { Env } from '../api/_types';
import { resolveActiveShare } from '../api/_share';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { token } = context.params as { token: string };
  const shell = await context.env.ASSETS.fetch(new Request('https://placeholder/index.html'));

  let ogTitle = '';
  let ogDesc = '';
  try {
    const share = await resolveActiveShare(context.env.DB, token);
    if (share) {
      const db = context.env.DB;
      const [trip, dests, dates] = await Promise.all([
        db.prepare('SELECT name, title, countries FROM trips WHERE id = ?').bind(share.trip_id).first<{ name: string | null; title: string | null; countries: string | null }>(),
        db.prepare('SELECT name FROM trip_destinations WHERE trip_id = ? ORDER BY dest_order ASC LIMIT 3').bind(share.trip_id).all<{ name: string }>(),
        db.prepare("SELECT MIN(date) AS s, MAX(date) AS e FROM trip_days WHERE trip_id = ? AND date IS NOT NULL AND date != ''").bind(share.trip_id).first<{ s: string | null; e: string | null }>(),
      ]);
      if (trip) {
        const name = (trip.title || trip.name || '行程').trim();
        const destStr = (dests.results ?? []).map((d) => d.name).filter(Boolean).join('、') || (trip.countries ?? '');
        const dateStr = dates?.s ? (dates.s === dates.e ? dates.s : `${dates.s} – ${dates.e}`) : '';
        ogTitle = `${name} · Tripline 行程分享`;
        ogDesc = [dateStr, destStr].filter(Boolean).join(' · ') || '不用登入即可查看這份行程';
      }
    }
  } catch {
    // fall through — serve the plain shell so /s/:token never breaks
  }

  if (!ogTitle) return shell; // invalid / revoked / expired / error → default OG

  const url = new URL(context.request.url);
  const shareUrl = `${url.origin}/s/${token}`;
  const set = (content: string) => ({ element(el: { setAttribute(n: string, v: string): void }) { el.setAttribute('content', content); } });
  return new HTMLRewriter()
    .on('title', { element(el) { el.setInnerContent(ogTitle); } })
    .on('meta[property="og:title"]', set(ogTitle))
    .on('meta[property="og:description"]', set(ogDesc))
    .on('meta[property="og:url"]', set(shareUrl))
    .on('meta[name="twitter:title"]', set(ogTitle))
    .on('meta[name="twitter:description"]', set(ogDesc))
    .transform(shell);
};

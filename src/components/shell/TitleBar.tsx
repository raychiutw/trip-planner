/**
 * TitleBar — V2 Terracotta page chrome primitive (2026-05-03 PageHeader 退役後唯一)。
 *
 * 用於所有 page (主功能 / settings 子頁 / form 全頁)。簡化 API：
 * title / back / actions / backLabel — 無 eyebrow / meta / variant / align。
 * eyebrow + meta 改用 inline `.tp-page-eyebrow` + `.tp-page-meta` 在 TitleBar
 * 下方第一行 (settings 子頁 + list page 的資訊密度需求)。
 *
 * 視覺對應：docs/design-sessions/terracotta-preview-v2.html Section 23 + .tp-page-titlebar
 *           - Desktop 64px / padding 0 24px / title 20px
 *           - Compact 56px / padding 0 16px / title 18px
 *           - sticky + HIG scroll edge effect：捲到頂無材質無分隔線，
 *             捲動後 .is-scrolled 掛 Regular Glass + hairline，200ms 淡入
 *
 * CSS：`css/tokens.css` 的 `.tp-titlebar`（@761 與 @760 兩份 media block，材質是複製貼上關係）。
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import Icon from '../shared/Icon';
import { findScrollAncestor, scrollTopOf } from '../../lib/scrollAncestor';

/** 超過這個位移就視為「內容已從 header 下方流過」，材質淡入。4px 吸收次像素抖動。 */
const SCROLL_EDGE_THRESHOLD_PX = 4;

export interface TitleBarProps {
  /** Optional DOM id for pages that align scroll offsets to the sticky chrome. */
  id?: string;
  /** Optional extra class for page-specific print / scroll rules. */
  className?: string;
  /** Page title — primary identity. ReactNode 允許 inline accent span / `<br/>`。 */
  title: ReactNode;
  /** 提供 callback 即顯示左側 44×44 返回 button（HIG 最小觸控區；行程詳情頁專用）。 */
  back?: () => void;
  /** 右側 actions slot（icon button、menu trigger、primary button）。 */
  actions?: ReactNode;
  /** 返回 button 的 aria-label，預設「返回」。 */
  backLabel?: string;
  /**
   * rev2 §10.5：macOS toolbar 式返回 — 顯示可見「‹ <backLabel>」文字（chevron + 文字）。
   * 子頁（collab/explore）用；預設 false = icon-only 44×44（行程詳情）。
   */
  backLabelVisible?: boolean;
  /** rev2：手機統一 header 右上帳號圓圈（<AccountCircle/>）。桌機由 CSS 隱藏。 */
  account?: ReactNode;
  /**
   * 恆為材質態，不做 scroll edge effect。給**沒有捲動容器**的頁面用（MapPage 的
   * `.map-page-wrap { overflow: hidden }`）—— 那種頁面永遠捲不動，預設會卡在透明態，
   * 標題直接壓在地圖圖磚上，衛星影像時完全不可讀。
   */
  alwaysSolid?: boolean;
}

export default function TitleBar({ id, className, title, back, actions, backLabel = '返回', backLabelVisible = false, account, alwaysSolid = false }: TitleBarProps) {
  const ref = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);
  /* RBP-19（rerender-use-ref-transient-values）：scroll handler 每秒可觸發 60+ 次，
   * 但我們只關心「跨過門檻沒有」這個布林。用 ref 記住上一次的值，只有真的翻轉才
   * setState —— 否則等於在捲動熱路徑上每 frame 呼叫一次 setState。 */
  const scrolledRef = useRef(false);

  /* HIG scroll edge effect：捲到頂 → 無材質無分隔線；內容開始從下方流過 → 材質淡入。
   * 綁**捲動祖先**而非 window（見 lib/scrollAncestor 註解：本專案 document 永不捲動）。 */
  useEffect(() => {
    if (alwaysSolid) return;
    const el = ref.current;
    if (!el) return;
    const scrollTarget = findScrollAncestor(el);
    function syncScrolledState() {
      const isScrolled = scrollTopOf(scrollTarget) > SCROLL_EDGE_THRESHOLD_PX;
      if (isScrolled === scrolledRef.current) return;
      scrolledRef.current = isScrolled;
      setScrolled(isScrolled);
    }
    syncScrolledState(); // 掛載時就對齊（例如從別頁返回時容器已有捲動位移）
    scrollTarget.addEventListener('scroll', syncScrolledState, { passive: true });
    return () => scrollTarget.removeEventListener('scroll', syncScrolledState);
  }, [alwaysSolid]);

  const headerClass = [
    'tp-titlebar',
    (alwaysSolid || scrolled) && 'is-scrolled',
    className,
  ].filter(Boolean).join(' ');

  return (
    <header ref={ref} id={id} className={headerClass} data-titlebar="true" data-testid="titlebar">
      {back && (
        <button
          type="button"
          className={backLabelVisible ? 'tp-titlebar-back tp-titlebar-back--labeled' : 'tp-titlebar-back'}
          onClick={back}
          aria-label={backLabel}
        >
          <Icon name={backLabelVisible ? 'chevron-left' : 'arrow-left'} />
          {backLabelVisible && <span className="tp-titlebar-back-label">{backLabel}</span>}
        </button>
      )}
      <h1 className="tp-titlebar-title">{title}</h1>
      {actions && <div className="tp-titlebar-actions">{actions}</div>}
      {account}
    </header>
  );
}

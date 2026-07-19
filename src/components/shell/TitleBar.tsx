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
 *           - sticky + glass blur 14px + hairline border-bottom
 *
 * CSS：`css/tokens.css` L1226+ `.tp-titlebar`。
 */
import type { ReactNode } from 'react';
import Icon from '../shared/Icon';

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
}

export default function TitleBar({ id, className, title, back, actions, backLabel = '返回', backLabelVisible = false, account }: TitleBarProps) {
  const headerClass = className ? `tp-titlebar ${className}` : 'tp-titlebar';
  return (
    <header id={id} className={headerClass} data-titlebar="true" data-testid="titlebar">
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

/**
 * TitleBar — V2 Terracotta page chrome primitive.
 *
 * 用於 mockup 涵蓋 6 主功能頁（Chat / Trips / Trip detail / Map / Explore /
 * Account）。簡化 API：title / back / actions / backLabel — 無 eyebrow / meta /
 * variant / align（splash / auth / settings 子頁繼續用 PageHeader，見
 * openspec/changes/terracotta-pages-refactor/design.md D1）。
 *
 * 視覺對應：docs/design-sessions/terracotta-preview-v2.html `.tp-page-titlebar`
 *           - Desktop 64px / padding 0 24px / title 20px
 *           - Compact 56px / padding 0 16px / title 18px
 *           - sticky + glass blur 14px + hairline border-bottom
 *
 * CSS：使用 dedicated `.tp-titlebar` class（不 reuse `.tp-page-header`，因為 V2
 *      Terracotta 的 64px 與字級 20px 跟 PageHeader 既有 56px / 17px 不同）。
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
  /** 提供 callback 即顯示左側 36×36 返回 button（行程詳情頁專用）。 */
  back?: () => void;
  /** 右側 actions slot（icon button、menu trigger、primary button）。 */
  actions?: ReactNode;
  /** 返回 button 的 aria-label，預設「返回」。 */
  backLabel?: string;
}

export default function TitleBar({ id, className, title, back, actions, backLabel = '返回' }: TitleBarProps) {
  const headerClass = className ? `tp-titlebar ${className}` : 'tp-titlebar';
  return (
    <header id={id} className={headerClass} data-titlebar="true">
      {back && (
        <button
          type="button"
          className="tp-titlebar-back"
          onClick={back}
          aria-label={backLabel}
        >
          <Icon name="arrow-left" />
        </button>
      )}
      <h1 className="tp-titlebar-title">{title}</h1>
      {actions && <div className="tp-titlebar-actions">{actions}</div>}
    </header>
  );
}

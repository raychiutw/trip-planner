/**
 * TitleBar — V2 Terracotta page chrome primitive.
 *
 * 用於 mockup 涵蓋 6 主功能頁（Chat / Trips / Trip detail / Map / Explore /
 * Account）。簡化 API：title / back / actions / backLabel — 無 eyebrow / meta /
 * variant / align（splash / auth / settings 子頁繼續用 PageHeader，見
 * openspec/changes/terracotta-pages-refactor/design.md D1）。
 *
 * 視覺對應：docs/design-sessions/terracotta-preview-v2.html sections 13-20
 *           docs/design-sessions/2026-04-27-unified-layout-plan.md TitleBar 表格
 *
 * CSS：reuse 既有 `.tp-page-header` sticky / glass / hairline 樣式（tokens.css），
 *      加 `data-titlebar="true"` 屬性供未來 TitleBar-only override 用。
 */
import type { ReactNode } from 'react';
import Icon from '../shared/Icon';

export interface TitleBarProps {
  /** Page title — primary identity. ReactNode 允許 inline accent span / `<br/>`。 */
  title: ReactNode;
  /** 提供 callback 即顯示左側 36×36 返回 button（行程詳情頁專用）。 */
  back?: () => void;
  /** 右側 actions slot（icon button、menu trigger、primary button）。 */
  actions?: ReactNode;
  /** 返回 button 的 aria-label，預設「返回」。 */
  backLabel?: string;
}

export default function TitleBar({ title, back, actions, backLabel = '返回' }: TitleBarProps) {
  return (
    <header
      className="tp-page-header"
      data-titlebar="true"
      data-variant="sticky"
      data-align="left"
    >
      {back && (
        <button
          type="button"
          className="tp-page-header-back"
          onClick={back}
          aria-label={backLabel}
        >
          <Icon name="arrow-left" />
        </button>
      )}
      <div className="tp-page-header-text">
        <h1 className="tp-page-header-h1">{title}</h1>
      </div>
      {actions && <div className="tp-page-header-actions">{actions}</div>}
    </header>
  );
}

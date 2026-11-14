/** 側欄切換鈕（#1708）：展開時在側欄品牌列右側，收合後浮在中欄左上（AppShell 渲染 float 版）。 */
import { toggleSidebar, useSidebarCollapsed } from '../../lib/sidebarCollapse';
import { shortcutAttrs, shortcutTitle } from '../../lib/globalShortcuts';

export default function SidebarToggle({ float = false }: { float?: boolean }) {
  const collapsed = useSidebarCollapsed();
  const label = collapsed ? '顯示側欄' : '隱藏側欄';
  return (
    <button
      type="button"
      className={float ? 'tp-sidebar-toggle tp-sidebar-toggle-float' : 'tp-sidebar-toggle'}
      aria-label={label}
      title={shortcutTitle(label, 'sidebar')}
      aria-expanded={!collapsed}
      aria-controls="desktop-sidebar"
      data-testid={float ? 'sidebar-toggle-float' : 'sidebar-toggle'}
      onClick={toggleSidebar}
      {...shortcutAttrs('sidebar')}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4.5" width="18" height="15" rx="3" /><path d="M9.5 4.5v15" />
      </svg>
    </button>
  );
}

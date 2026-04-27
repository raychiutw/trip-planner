/**
 * MapEntryCard — Map page entry card primitive (horizontal snap-scroll item).
 *
 * 上排：num（dayColor border + dayColor 文字）+ dayLabel eyebrow（dayColor）+ time
 * 下排：leading type icon（依 kind 對映 i-bed / i-utensils / i-camera / i-bag）+ title
 * Active：card border-color = accent + ring + num filled accent + icon accent
 *
 * 視覺對應：docs/design-sessions/terracotta-preview-v2.html Section 20 entry cards
 * Spec: openspec/changes/terracotta-pages-refactor/specs/terracotta-page-layout/spec.md
 *       Requirement「Pin type icon 系統（entry card 上）」
 */

export type EntryKind = 'hotel' | 'food' | 'sight' | 'shopping' | 'other';

const ICON_HREF_BY_KIND: Record<EntryKind, string | null> = {
  hotel: '#i-bed',
  food: '#i-utensils',
  sight: '#i-camera',
  shopping: '#i-bag',
  other: null,
};

export interface MapEntryCardProps {
  /** 該日序號（1-based，每天從 1 重新開始） */
  dayLocalIndex: number;
  /** 短 day label（"D1" / "D2"），eyebrow 顯示。Single-day 模式可省略以節省空間 */
  dayLabel?: string;
  /** dayColor hex，套 num border + day eyebrow */
  dayColor: string;
  /** 時間文字（"08:00" / "10:30"），可選 */
  time?: string;
  /** entry 名稱 */
  title: string;
  /** entry 類型，對映 leading icon */
  kind: EntryKind;
  /** active 狀態（marker focus / overview pick） */
  isActive: boolean;
  /** 點擊 callback（觸發 marker focus + flyTo） */
  onClick: () => void;
  /** 對應 entry id，用於 IntersectionObserver 反查（MapPage scroll spy） */
  dataEntryId?: number;
}

export default function MapEntryCard({
  dayLocalIndex,
  dayLabel,
  dayColor,
  time,
  title,
  kind,
  isActive,
  onClick,
  dataEntryId,
}: MapEntryCardProps) {
  const iconHref = ICON_HREF_BY_KIND[kind];
  return (
    <button
      type="button"
      role="listitem"
      aria-pressed={isActive}
      className={`tp-map-entry-card${isActive ? ' is-active' : ''}`}
      onClick={onClick}
      data-card-entry-id={dataEntryId}
    >
      <div className="tp-map-entry-card-top">
        <span
          className="tp-map-entry-card-num"
          style={isActive ? undefined : { borderColor: dayColor, color: dayColor }}
        >
          {dayLocalIndex}
        </span>
        {dayLabel && (
          <span className="tp-map-entry-card-day" style={{ color: dayColor }}>
            {dayLabel}
          </span>
        )}
        {time && <span className="tp-map-entry-card-time">{time}</span>}
      </div>
      <div className="tp-map-entry-card-body">
        {iconHref && (
          <span className="tp-map-entry-card-icon" aria-hidden="true">
            <svg>
              <use href={iconHref} />
            </svg>
          </span>
        )}
        <p className="tp-map-entry-card-title">{title}</p>
      </div>
    </button>
  );
}

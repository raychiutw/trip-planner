/**
 * MapEntryCard — Map page entry card primitive (horizontal snap-scroll item).
 *
 * 上排：num（dayColor border + dayColor 文字）+ dayLabel eyebrow（dayColor）+ time
 * 下排：leading type icon（依 kind 對映 i-bed / i-utensils / i-camera / i-bag）+ title
 * Active：card border-color = accent + ring + num filled accent + icon accent
 *
 * 視覺對應：docs/design-sessions/terracotta-preview-v2.html Section 20 entry cards
 * 規範：DESIGN.md §Stop Card 與 §地圖 chrome 子例外
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
  /** dayColor hex，套 num 圓框（非文字，飽和色本來就是給描邊的） */
  dayColor: string;
  /**
   * day 的**文字用**色，套 num 數字與 day eyebrow（#1168）。
   * 與 `dayColor` 分開是因為那組 Tailwind -500 當淺底文字 10 色全不達 AA（1.92–4.11:1）。
   * 呼叫方傳 `dayTextColor(dayNum)`，值是 `var(--day-text-N)` → CSS 按主題解析深淺兩套。
   */
  dayTextColor: string;
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
  dayTextColor,
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
      /* #1168：原本是 `aria-pressed={isActive}`，axe 判 aria-allowed-attr **critical**
       * —— 父容器是 role="list"（MapPage.tsx:583），所以這裡掛 role="listitem" 去滿足它，
       * 但 listitem 覆蓋了 <button> 的隱含 button role，而 aria-pressed 只允許用在 button。
       * 這 4 個節點是地圖頁整頁納入掃描時唯一剩下的違規（對比那 9 個已在本票修掉）。
       *
       * 改用 aria-current：它是**全域** ARIA 屬性、任何 role 都合法，而且語意更貼切 ——
       * 這些卡是「清單中的當前項」，不是可反覆按下放開的 toggle（aria-pressed 的語意）。
       * 不改成 <div role="listitem"><button> 包一層：那會讓 wrapper 變成 flex child，
       * flex: 0 0 220px 與 scroll-snap 都要搬，改動面遠大於本票該有的。 */
      aria-current={isActive ? 'true' : undefined}
      className={`tp-map-entry-card${isActive ? ' is-active' : ''}`}
      onClick={onClick}
      data-card-entry-id={dataEntryId}
    >
      <div className="tp-map-entry-card-top">
        {/* #1168：圓框吃飽和 dayColor（非文字用途），數字吃 dayTextColor。分開是因為那組
            Tailwind -500 當淺底文字 10 色全不達 AA。數字是**單一字元**，axe 的 color-contrast
            對 1 字元元素一律降級成 incomplete（messageKey: shortTextContent）→ e2e 掃不到，
            所以它由 tests/unit/day-palette-text.test.ts 守，不能只靠 e2e。 */}
        <span
          className="tp-map-entry-card-num"
          style={isActive ? undefined : { borderColor: dayColor, color: dayTextColor }}
        >
          {dayLocalIndex}
        </span>
        {dayLabel && (
          <span className="tp-map-entry-card-day" style={{ color: dayTextColor }}>
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

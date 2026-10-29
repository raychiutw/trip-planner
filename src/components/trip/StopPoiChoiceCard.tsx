/** 停留點展開明細內的單一 POI 卡（正選／備選 + 設為正選）（#1262 自 TimelineRail 拆出）。 */
import { memo, useState } from 'react';
import { setMaster } from '../../lib/entryMutations';
import { POI_TYPE_LABELS, poiCategoryLabel, type PoiType } from '../../lib/poiCategory';
import Icon from '../shared/Icon';
import { showToast } from '../shared/Toast';
import MarkdownText from '../shared/MarkdownText';
import MapLinks from './MapLinks';
import type { StopPoiOptionData } from './TimelineEvent';
import { condenseHours } from '../../lib/poiHours';

interface StopPoiChoiceCardProps {
  poi: StopPoiOptionData;
  tripId: string | null;
  entryId: number | null;
  dayNum: number | null;
}

export const StopPoiChoiceCard = memo(function StopPoiChoiceCard({
  poi, tripId, entryId, dayNum,
}: StopPoiChoiceCardProps) {
  const [promoting, setPromoting] = useState(false);
  const metaParts: string[] = [];
  if (typeof poi.rating === 'number') metaParts.push(`★ ${poi.rating.toFixed(1)}`);
  if (poi.price) metaParts.push(poi.price);
  const hoursStr = condenseHours(poi.hours);
  if (hoursStr) metaParts.push(hoursStr);
  if (poi.reservation) metaParts.push(poi.reservation);
  // poi.category 是 Google primaryType（英文）— 經 poiCategoryLabel 映射成中文，
  // 不再直接露英文（沖繩備選卡的「tourist_attraction」等）；空則 fallback poi.type。
  // 備選卡無相鄰粗類 badge，故保留 poi.type fallback（跟正選不同，正選只顯示細類）。
  const typeLabel = poiCategoryLabel(poi.category)
    ?? (poi.type ? POI_TYPE_LABELS[poi.type as PoiType] ?? poi.type : null);

  // 設為正選：把此備選 swap 成 entry 的 master POI（後端 PATCH /entries/:eid/master 做
  // swap sort_order + OCC + 同 TX mark segments stale）。promote 改變 entry 座標 → 觸發
  // travel 重算。poiId 缺（未存檔搜尋結果）→ 無 PATCH target，停用。跨區距離提醒留在
  // 全編輯頁；inline 走輕量快速 path，重算後 TravelPill 會顯示真實距離。
  // OCC：timeline 資料不帶 entry_pois_version，故 inline promote 走 LWW（同 inline 備註）；
  // 需嚴格防丟更新時走全編輯頁（帶 version）。
  const canPromote = poi.poiId != null && tripId != null && entryId != null;
  const handleSetMaster = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canPromote || promoting) return;
    setPromoting(true);
    try {
      // #1260 entry 變更 module：emit + 車程重算在 module 內；這裡只依 Result 決定 toast。
      const r = await setMaster(tripId, entryId, dayNum, poi.poiId!);
      if (!r.ok) {
        showToast('設為正選失敗', 'error', 5000);
        return;
      }
      showToast(`已將「${poi.name}」設為正選`, 'success', 3000);
    } finally {
      setPromoting(false);
    }
  };

  // v2.30.14：StopPoiChoiceCard 只渲染備選 (alternate)，「正選」已升格到景點說明。
  // v2.33.93 simplify: onClick stopPropagation 從 wrapper <div> 搬上 <article>，
  // 拔掉純為 event isolation 而存在的無布局意義 wrapper。
  return (
    <article className="tp-rail-poi-card" data-variant="alternate" onClick={(e) => e.stopPropagation()}>
      <div className="tp-rail-poi-head">
        <span className="tp-rail-poi-name">{poi.name}</span>
        {typeLabel && <span className="tp-rail-poi-type">{typeLabel}</span>}
        {poi.location && <MapLinks location={poi.location} inline />}
      </div>
      {metaParts.length > 0 && (
        <div className="tp-rail-poi-card-meta">{metaParts.join(' · ')}</div>
      )}
      {poi.description && (
        <MarkdownText text={poi.description} as="div" className="tp-rail-poi-desc" inline />
      )}
      {poi.note && (
        <MarkdownText text={poi.note} as="div" className="tp-rail-poi-note" inline />
      )}
      {canPromote && (
        <div className="tp-rail-poi-actions">
          <button
            type="button"
            className="tp-rail-set-master"
            onClick={handleSetMaster}
            disabled={promoting}
            data-testid={`timeline-rail-set-master-${entryId}-${poi.poiId}`}
          >
            <Icon name="swap-horizontal" />
            設為正選
          </button>
        </div>
      )}
    </article>
  );
});

/**
 * EntryTimeChip — timeline 展開列 header 內「起訖時間」可點 chip（V2）。點 chip → portal
 * 浮出共用 TripTimePicker（抵達 / 離開），就地改時間，不必進全編輯頁、不必展開列。
 *
 * 為何 portal：header 的 .tp-rail-content 是 overflow:hidden，inline 浮層會被裁切；portal
 * 到 document.body 逃離裁切，用 chip rect 定位（fixed）。outside-click 排除內層
 * TripTimePicker 的 .tp-time-popover portal，避免點時/分格誤關本 popup。
 *
 * 存檔：PATCH /trips/:id/entries/:eid { start_time | end_time }。後端會依抵達時間重排當日
 * （resortDayByArrival）；前端 dispatch entryUpdated + requestTravelRecompute 觸發重算與
 * refetch。LWW（同 inline 備註）— 不帶 OCC token。
 */

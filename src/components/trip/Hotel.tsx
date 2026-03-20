/* ===== Hotel Component ===== */
/* Renders a hotel card with: name, details, breakfast, checkout, info boxes */

import { useState, useCallback, memo } from 'react';
import Icon from '../shared/Icon';
import InfoBox, { type InfoBoxData } from './InfoBox';
import { ARROW_EXPAND, ARROW_COLLAPSE } from '../../lib/constants';

/** Breakfast data shape from dist JSON. */
interface BreakfastData {
  included?: boolean;
  note?: string | null;
}

/** Hotel data shape from dist JSON content.hotel. */
export interface HotelData {
  name: string;
  checkout?: string | null;
  details?: string[] | null;
  breakfast?: BreakfastData | null;
  note?: string | null;
  infoBoxes?: InfoBoxData[] | null;
}

interface HotelProps {
  hotel: HotelData;
}

export const Hotel = memo(function Hotel({ hotel }: HotelProps) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  return (
    <>
      <div className="col-row" onClick={toggle} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }} style={{ cursor: 'pointer' }} aria-expanded={open} aria-label={open ? '收合飯店詳情' : '展開飯店詳情'} role="button" tabIndex={0}>
        <Icon name="hotel" /> {hotel.name}{' '}
        <span className="arrow">{open ? ARROW_COLLAPSE : ARROW_EXPAND}</span>
      </div>
      <div className={`col-detail${open ? ' open' : ''}`}>
        {hotel.details && hotel.details.length > 0 && (
          <div className="hotel-detail-grid">
            {hotel.details.map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
        )}
        {hotel.breakfast && (
          <div className="hotel-sub">
            <Icon name="utensils" />{' '}
            {hotel.breakfast.included === true ? (
              <>
                含早餐
                {hotel.breakfast.note && <>（{hotel.breakfast.note}）</>}
              </>
            ) : hotel.breakfast.included === false ? (
              '不含早餐'
            ) : (
              '早餐：資料未提供'
            )}
          </div>
        )}
        {hotel.checkout && (
          <div className="hotel-sub">
            <Icon name="clock" /> 退房 {hotel.checkout}
          </div>
        )}
        {hotel.infoBoxes && hotel.infoBoxes.length > 0 &&
          hotel.infoBoxes.map((box, i) => (
            <InfoBox key={i} box={box} />
          ))
        }
      </div>
    </>
  );
});

export default Hotel;

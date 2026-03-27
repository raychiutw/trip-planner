/* ===== Hotel Component ===== */
/* Renders a hotel card with: name, details, breakfast, checkout, info boxes */

import { useState, useCallback, memo } from 'react';
import clsx from 'clsx';
import { marked } from 'marked';
import Icon from '../shared/Icon';
import InfoBox, { type InfoBoxData } from './InfoBox';
import { ARROW_EXPAND, ARROW_COLLAPSE } from '../../lib/constants';
import { sanitizeHtml } from '../../lib/sanitize';

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
      <div className="flex items-center gap-2 py-2 px-3 -mx-3 select-none cursor-pointer rounded-sm transition-colors duration-fast ease-apple hover:bg-accent-bg" onClick={toggle} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }} aria-expanded={open} aria-label={open ? '收合飯店詳情' : '展開飯店詳情'} role="button" tabIndex={0}>
        <Icon name="hotel" /> {hotel.name}{' '}
        <span className="ml-auto text-muted text-subheadline">{open ? ARROW_COLLAPSE : ARROW_EXPAND}</span>
      </div>
      <div className={clsx('hidden print:block py-3 text-body leading-relaxed', open && '!block')}>
        {hotel.details && hotel.details.length > 0 && (
          <div className="flex flex-wrap gap-2 gap-x-4 mb-2">
            {hotel.details.map((d, i) => (
              <span key={i} dangerouslySetInnerHTML={{ __html: sanitizeHtml(marked.parseInline(d) as string) }} />
            ))}
          </div>
        )}
        {hotel.breakfast && (
          <div className="mt-2 py-1 pl-4">
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
          <div className="mt-2 py-1 pl-4">
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

import Icon from '../shared/Icon';
import { escUrl } from '../../lib/sanitize';

/* ===== Types ===== */

interface Contact {
  label?: string;
  phone?: string;
  url?: string;
  note?: string;
}

interface EmergencyCard {
  title?: string;
  contacts?: Contact[];
  address?: string;
  notes?: string[];
  items?: string[];
}

export interface EmergencyData {
  _title?: string;
  title?: string;
  cards?: EmergencyCard[];
}

/* ===== Props ===== */

interface EmergencyProps {
  data: EmergencyData;
}

/* ===== Component ===== */

export default function Emergency({ data }: EmergencyProps) {
  if (!data.cards || !data.cards.length) return null;

  return (
    <div className="ov-grid">
      {data.cards.map((card, i) => (
        <div key={i} className="ov-card">
          {card.title && <h4>{card.title}</h4>}
          {card.contacts &&
            card.contacts.map((c, j) => {
              const cUrl = escUrl(c.url || (c.phone ? 'tel:' + c.phone : ''));
              return (
                <p key={j}>
                  {cUrl ? (
                    <a href={cUrl} target="_blank" rel="noopener noreferrer">
                      {c.label || c.phone}
                    </a>
                  ) : (
                    c.label || c.phone || ''
                  )}
                  {c.note && <>：{c.note}</>}
                </p>
              );
            })}
          {card.address && (
            <p>
              <Icon name="location-pin" /> {card.address}
            </p>
          )}
          {card.notes &&
            card.notes.map((n, j) => <p key={`n${j}`}>{n}</p>)}
          {card.items && card.items.length > 0 && (
            <p>
              {card.items.map((item, j) => (
                <span key={j}>
                  {item}
                  <br />
                </span>
              ))}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

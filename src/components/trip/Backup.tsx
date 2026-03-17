import Icon from '../shared/Icon';

/* ===== Types ===== */

interface BackupCard {
  title?: string;
  description?: string;
  weatherItems?: string[];
  items?: string[];
}

export interface BackupData {
  _title?: string;
  title?: string;
  cards?: BackupCard[];
  items?: string[];
}

/* ===== Props ===== */

interface BackupProps {
  data: BackupData;
}

/* ===== Component ===== */

export default function Backup({ data }: BackupProps) {
  if (data.cards && data.cards.length) {
    return (
      <div className="ov-grid ov-grid-2">
        {data.cards.map((card, i) => (
          <div key={i} className="ov-card">
            {card.title && <h4>{card.title}</h4>}
            {card.description && <p>{card.description}</p>}
            {card.weatherItems && card.weatherItems.length > 0 && (
              <ul className="weather-list">
                {card.weatherItems.map((w, j) => (
                  <li key={j}>
                    <span className="list-icon">
                      <Icon name="wave" />
                    </span>
                    {w}
                  </li>
                ))}
              </ul>
            )}
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

  if (data.items && data.items.length) {
    return (
      <ul className="notes-list">
        {data.items.map((item, i) => (
          <li key={i}>
            <span className="list-icon">
              <Icon name="pin" />
            </span>
            {item}
          </li>
        ))}
      </ul>
    );
  }

  return null;
}

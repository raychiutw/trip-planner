import Icon from '../shared/Icon';

/* ===== Types ===== */

interface ChecklistCard {
  title?: string;
  items?: string[];
}

export interface ChecklistData {
  _title?: string;
  title?: string;
  cards?: ChecklistCard[];
  items?: string[];
}

/* ===== Props ===== */

interface ChecklistProps {
  data: ChecklistData;
}

/* ===== Component ===== */

export default function Checklist({ data }: ChecklistProps) {
  if (data.cards && data.cards.length) {
    return (
      <div className="ov-grid">
        {data.cards.map((card, i) => (
          <div key={i} className="ov-card">
            {card.title && <h4>{card.title}</h4>}
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

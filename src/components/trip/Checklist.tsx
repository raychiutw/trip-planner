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
      <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
        {data.cards.map((card, i) => (
          <div key={i} className="bg-accent-bg rounded-sm p-4">
            {card.title && <h4 className="relative pl-4 mt-0"><span className="absolute left-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-accent" />{card.title}</h4>}
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
      <ul className="list-none p-0 mt-2">
        {data.items.map((item, i) => (
          <li key={i} className="py-1 text-body flex items-baseline gap-2">
            <span className="shrink-0">
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

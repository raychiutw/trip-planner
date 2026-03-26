import { renderMarkdown } from '../../lib/sanitize';

/* ===== Types ===== */

interface SuggestionCard {
  title?: string;
  priority?: string;
  items?: string[];
}

export interface SuggestionsData {
  _title?: string;
  title?: string;
  cards?: SuggestionCard[];
  content?: string;
}

/* ===== Props ===== */

interface SuggestionsProps {
  data: SuggestionsData;
}

/* ===== Component ===== */

export default function Suggestions({ data }: SuggestionsProps) {
  /* Structured cards mode */
  if (data.cards && data.cards.length > 0) {
    return (
      <>
        {data.cards.map((card, i) => {
          const priorityStyles: Record<string, string> = {
            high: 'bg-priority-high-bg rounded-sm p-3',
            medium: 'bg-priority-medium-bg rounded-sm p-3',
            low: 'bg-priority-low-bg rounded-sm p-3',
          };
          const base = 'py-2';
          const cls = card.priority && priorityStyles[card.priority]
            ? priorityStyles[card.priority]
            : base;
          return (
            <div key={i} className={cls}>
              {card.title && <h4 className="m-0 mb-2 flex items-center">{card.title}</h4>}
              {card.items &&
                card.items.map((item, j) => <p key={j} className="text-body my-1 leading-relaxed">{item}</p>)}
            </div>
          );
        })}
      </>
    );
  }

  /* Markdown content mode */
  if (data.content) {
    return (
      <div
        className="text-body leading-relaxed"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(data.content) }}
      />
    );
  }

  return null;
}

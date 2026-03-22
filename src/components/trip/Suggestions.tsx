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
          const priorityClass = card.priority
            ? ` sg-priority-${card.priority}`
            : '';
          return (
            <div key={i} className={`suggestion-card${priorityClass}`}>
              {card.title && <h4>{card.title}</h4>}
              {card.items &&
                card.items.map((item, j) => <p key={j}>{item}</p>)}
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
        className="suggestions-markdown"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(data.content) }}
      />
    );
  }

  return null;
}

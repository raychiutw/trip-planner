/**
 * IdeasTabContent — TripSheet 的 Ideas tab real UI（B-P5 / B-P6 task 4.1）
 *
 * Source: GET /api/trip-ideas?tripId=...
 * Actions:
 *   - 「+ 加入 Day N」text-based promote — POST /api/trips/:id/days/:num/entries +
 *     PATCH /api/trip-ideas/:id { promotedToEntryId }
 *   - 「移除」DELETE /api/trip-ideas/:id（soft delete via archived_at）
 *
 * 不含：dnd-kit drag interaction（B-P5 後續 PR）/ conflict modal / undo toast / smart placement
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetchRaw } from '../../lib/apiClient';
import type { TripIdea } from '../../types/api';

const SCOPED_STYLES = `
.tp-ideas-list {
  flex: 1; min-height: 0; overflow-y: auto;
  display: flex; flex-direction: column; gap: 8px;
  padding: 16px;
}
.tp-idea-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 12px 14px;
  background: var(--color-background);
  display: flex; flex-direction: column; gap: 6px;
}
.tp-idea-card-header {
  display: flex; align-items: flex-start; gap: 8px;
  font-size: var(--font-size-callout); font-weight: 600;
  color: var(--color-foreground);
}
.tp-idea-card-meta {
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
  display: flex; gap: 8px; flex-wrap: wrap;
}
.tp-idea-card-actions {
  display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px;
}
.tp-idea-card-action {
  font: inherit; font-size: var(--font-size-footnote); font-weight: 500;
  padding: 4px 10px; border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-background); color: var(--color-foreground);
  cursor: pointer; min-height: var(--spacing-tap-min);
}
.tp-idea-card-action:hover { border-color: var(--color-accent); color: var(--color-accent); }
.tp-idea-card-action.is-danger:hover { border-color: #dc2626; color: #dc2626; }
.tp-idea-card-action[disabled] { opacity: 0.5; cursor: not-allowed; }
.tp-idea-card-promoted {
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
  font-style: italic;
}
.tp-ideas-empty {
  flex: 1;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px; padding: 48px 24px; text-align: center;
  color: var(--color-muted);
}
.tp-ideas-empty .eyebrow {
  font-size: var(--font-size-eyebrow); font-weight: 700;
  letter-spacing: 0.22em; text-transform: uppercase;
}
.tp-ideas-empty h3 {
  font-size: var(--font-size-title3); font-weight: 700;
  letter-spacing: -0.01em; color: var(--color-foreground);
}
.tp-ideas-empty p { font-size: var(--font-size-callout); max-width: 320px; }
.tp-ideas-status {
  font-size: var(--font-size-footnote); color: var(--color-muted);
  padding: 8px 16px;
}
`;

export interface IdeasTabContentProps {
  tripId: string;
  /** Optional：days available for promote dropdown。空陣列時 promote 隱藏。 */
  dayNumbers?: number[];
}

export default function IdeasTabContent({ tripId, dayNumbers = [] }: IdeasTabContentProps) {
  const [ideas, setIdeas] = useState<TripIdea[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const res = await apiFetchRaw(`/api/trip-ideas?tripId=${encodeURIComponent(tripId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { ideas?: TripIdea[] };
      setIdeas(data.ideas ?? []);
    } catch (e) {
      setError((e as Error).message ?? '無法載入 ideas');
      setIdeas([]);
    }
  }, [tripId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleDelete = useCallback(
    async (id: number) => {
      setBusyId(id);
      try {
        const res = await apiFetchRaw(`/api/trip-ideas/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`DELETE failed: HTTP ${res.status}`);
        await reload();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusyId(null);
      }
    },
    [reload],
  );

  const handlePromote = useCallback(
    async (idea: TripIdea, dayNum: number) => {
      if (!idea.poiId) {
        setError('此 idea 未綁 POI，無法直接 promote');
        return;
      }
      setBusyId(idea.id);
      try {
        const create = await apiFetchRaw(
          `/api/trips/${encodeURIComponent(tripId)}/days/${dayNum}/entries`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ poiId: idea.poiId, name: idea.title }),
          },
        );
        if (!create.ok) throw new Error(`promote create entry failed: ${create.status}`);
        const created = (await create.json()) as { id?: number };
        if (created?.id) {
          await apiFetchRaw(`/api/trip-ideas/${idea.id}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ promotedToEntryId: created.id }),
          });
        }
        await reload();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusyId(null);
      }
    },
    [reload, tripId],
  );

  const activeIdeas = useMemo(
    () => (ideas ?? []).filter((i) => !i.archivedAt),
    [ideas],
  );

  return (
    <>
      <style>{SCOPED_STYLES}</style>
      {error && <div className="tp-ideas-status" role="alert" data-testid="ideas-error">⚠ {error}</div>}
      {ideas === null && (
        <div className="tp-ideas-status" data-testid="ideas-loading">載入中…</div>
      )}
      {ideas !== null && activeIdeas.length === 0 && (
        <div className="tp-ideas-empty" data-testid="ideas-empty">
          <div className="eyebrow">Ideas</div>
          <h3>還沒收藏任何想法</h3>
          <p>從探索頁加入想法，或直接從聊天告訴 AI「想加 X 餐廳」。</p>
        </div>
      )}
      {ideas !== null && activeIdeas.length > 0 && (
        <ul className="tp-ideas-list" data-testid="ideas-list">
          {activeIdeas.map((idea) => (
            <li key={idea.id} className="tp-idea-card">
              <div className="tp-idea-card-header">{idea.title}</div>
              {(idea.poiAddress || idea.poiType) && (
                <div className="tp-idea-card-meta">
                  {idea.poiType && <span>{idea.poiType}</span>}
                  {idea.poiAddress && <span>{idea.poiAddress}</span>}
                </div>
              )}
              {idea.note && <div className="tp-idea-card-meta">{idea.note}</div>}
              {idea.promotedToEntryId ? (
                <div className="tp-idea-card-promoted">
                  ✓ 已排入 entry #{idea.promotedToEntryId}
                </div>
              ) : (
                <div className="tp-idea-card-actions">
                  {idea.poiId && dayNumbers.length > 0 ? (
                    dayNumbers.map((d) => (
                      <button
                        key={d}
                        type="button"
                        className="tp-idea-card-action"
                        disabled={busyId === idea.id}
                        onClick={() => handlePromote(idea, d)}
                        data-testid={`ideas-promote-${idea.id}-day-${d}`}
                      >
                        + Day {d}
                      </button>
                    ))
                  ) : (
                    !idea.poiId && (
                      <span className="tp-idea-card-meta">（自由文字 idea，需先綁 POI 才能 promote）</span>
                    )
                  )}
                  <button
                    type="button"
                    className="tp-idea-card-action is-danger"
                    disabled={busyId === idea.id}
                    onClick={() => handleDelete(idea.id)}
                    data-testid={`ideas-delete-${idea.id}`}
                  >
                    移除
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

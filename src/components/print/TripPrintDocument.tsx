/**
 * TripPrintDocument — flat, fully-expanded, data-driven trip document for print/PDF.
 *
 * Pure presentational (no interaction, no collapse). Variant A「緊湊表格式」,
 * signed off 2026-05-30 (docs/design-sessions/2026-05-30-trip-print-document.html).
 * Renders from TripPrintData so print + PDF never inherit accordion state.
 */
import Icon from '../shared/Icon';
import {
  tripDisplayName,
  formatTravelLine,
  type TripPrintData,
  type PrintEntry,
  type PrintFlight,
  type PrintLodging,
  type PrintReservation,
  type PrintPretripNote,
  type PrintEmergencyContact,
} from '../../lib/tripPrintData';

const j = (...parts: (string | undefined | null | number)[]) =>
  parts.map((p) => (p == null ? '' : String(p)).trim()).filter(Boolean).join('　');

function Rating({ value }: { value?: number | null }) {
  if (typeof value !== 'number') return null;
  return <span className="tp-print-star">★ {value.toFixed(1)}</span>;
}

function EntryRow({ entry }: { entry: PrintEntry }) {
  const alts = (entry.stopPois ?? []).filter((p) => p.sortOrder !== 1 && p.name);
  const travel = formatTravelLine(entry.travel);
  // Responsive grid (not a <table>): ≥640px renders as 3 columns (time | activity
  // | travel); <640px stacks via @media in tripPrintStyles. Actual print/PDF (A4
  // width) keeps the 3-column layout.
  return (
    <div className="tp-print-entry">
      <div className="tp-print-t">{entry.time || '—'}</div>
      <div className="tp-print-title">
        {entry.title} <Rating value={entry.rating} />
      </div>
      {alts.length > 0 && (
        <div className="tp-print-alt">備選：{alts.map((p) => p.name).join(' · ')}</div>
      )}
      {entry.note && <div className="tp-print-note">{entry.note}</div>}
      <div className="tp-print-mv">{travel || '—'}</div>
    </div>
  );
}

const NOTE_SECTIONS = [
  {
    key: 'flights',
    label: '航班',
    icon: 'plane',
    line: (f: PrintFlight) => j(`${f.airline ?? ''} ${f.flightNo ?? ''}`.trim(),
      [f.departAirport, f.departAt].filter(Boolean).join(' '),
      (f.arriveAirport || f.arriveAt) ? `→ ${[f.arriveAirport, f.arriveAt].filter(Boolean).join(' ')}` : '',
      f.note),
  },
  {
    key: 'lodgings',
    label: '住宿',
    icon: 'hotel',
    line: (l: PrintLodging) => j(l.name, [l.checkInAt, l.checkOutAt].filter(Boolean).join('–'), l.address, l.phone, l.bookingNo),
  },
  {
    key: 'reservations',
    label: '預訂',
    icon: 'check-circle',
    line: (r: PrintReservation) => j(r.title, r.reservedAt, r.partySize ? `${r.partySize} 位` : '', r.reservationNo, r.phone, r.note),
  },
  {
    key: 'pretrip',
    label: '行前須知',
    icon: 'document',
    line: (p: PrintPretripNote) => j(p.title ? `${p.title}：${p.content ?? ''}` : (p.content ?? '')),
  },
  {
    key: 'emergency',
    label: '緊急聯絡',
    icon: 'phone',
    line: (e: PrintEmergencyContact) => j(e.name, e.relationship ? `（${e.relationship}）` : '', e.phone, e.email),
  },
] as const;

type NotesMap = TripPrintData['notes'];
type NoteKey = (typeof NOTE_SECTIONS)[number]['key'];
const NOTE_ROWS: Record<NoteKey, (n: NotesMap) => unknown[]> = {
  flights: (n) => n.flights,
  lodgings: (n) => n.lodgings,
  reservations: (n) => n.reservations,
  pretrip: (n) => n.pretripNotes,
  emergency: (n) => n.emergencyContacts,
};

export default function TripPrintDocument({ data }: { data: TripPrintData }) {
  const name = tripDisplayName(data);
  const meta = [data.dateRange, data.destinations, data.days.length ? `${data.days.length} 天` : '']
    .filter(Boolean);
  const visibleNotes = NOTE_SECTIONS
    .map((s) => ({ s, rows: NOTE_ROWS[s.key](data.notes) }))
    .filter(({ rows }) => rows.length > 0);

  return (
    <article className="tp-print-doc" data-testid="trip-print-document">
      <header className="tp-print-dh">
        <div className="tp-print-name" data-testid="print-doc-name">{name}</div>
        {meta.length > 0 && (
          <div className="tp-print-meta">
            {meta.map((m, i) => <span key={i}>{m}</span>)}
          </div>
        )}
      </header>

      {data.days.length === 0 ? (
        <div className="tp-print-empty" data-testid="print-empty-days">尚無行程</div>
      ) : (
        data.days.map((day) => (
          <section className="tp-print-day" key={day.dayNum} data-testid={`print-day-${day.dayNum}`}>
            <div className="tp-print-day-hd">
              <span className="tp-print-day-no">Day {day.dayNum}</span>
              <span className="tp-print-day-date">
                {[day.date, day.dayOfWeek ? `（${day.dayOfWeek}）` : '', day.label].filter(Boolean).join(' ')}
              </span>
            </div>
            <div className="tp-print-day-entries">
              {day.timeline.map((entry, idx) => (
                <EntryRow key={idx} entry={entry} />
              ))}
              {day.hotel && (
                <div className="tp-print-hotel">
                  <span className="tp-print-hk">住宿</span>
                  <span>
                    {day.hotel.name} <Rating value={day.hotel.rating} />
                    {day.hotel.note ? ` · ${day.hotel.note}` : ''}
                  </span>
                </div>
              )}
            </div>
          </section>
        ))
      )}

      {visibleNotes.length > 0 && (
        <section className="tp-print-notes">
          <h2 className="tp-print-notes-h">行程筆記</h2>
          <div className="tp-print-ngrid">
            {visibleNotes.map(({ s, rows }) => (
              <div className="tp-print-nsec" key={s.key} data-testid={`print-note-${s.key}`}>
                <div className="tp-print-nh"><Icon name={s.icon} /> {s.label}</div>
                {rows.map((row, i) => {
                  const text = (s.line as (r: unknown) => string)(row);
                  return text ? <p key={i}>{text}</p> : null;
                })}
              </div>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}

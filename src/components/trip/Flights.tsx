import Icon from '../shared/Icon';

/* ===== Types ===== */

interface FlightSegment {
  label?: string;
  flightNo?: string;
  route?: string;
  time?: string;
}

interface AirlineInfo {
  name?: string;
  note?: string;
}

export interface FlightsData {
  _title?: string;
  title?: string;
  segments?: FlightSegment[];
  airline?: AirlineInfo;
}

/* ===== Props ===== */

interface FlightsProps {
  data: FlightsData;
}

/* ===== Component ===== */

export default function Flights({ data }: FlightsProps) {
  return (
    <>
      {data.segments &&
        data.segments.map((seg, i) => {
          const isReturn = seg.label && seg.label.indexOf('回') >= 0;
          return (
            <div key={i} className="flex items-center p-3 rounded-md gap-2">
              <span className="text-title3 shrink-0 flex items-center">
                {isReturn ? <Icon name="landing" /> : <Icon name="takeoff" />}
              </span>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 flex-1 min-w-0">
                {seg.label && (
                  <span className="font-bold text-headline whitespace-nowrap">{seg.label}</span>
                )}
                {seg.flightNo && (
                  <span className="font-semibold text-title3 whitespace-nowrap">{seg.flightNo}</span>
                )}
                {seg.route && (
                  <span className="font-semibold text-title3 whitespace-nowrap">{seg.route}</span>
                )}
                {seg.time && (
                  <span className="text-callout text-muted whitespace-nowrap">{seg.time}</span>
                )}
              </div>
            </div>
          );
        })}
      {data.airline && (
        <div className="flex items-center p-3 rounded-md gap-2">
          <span className="text-title3 shrink-0 flex items-center">
            <Icon name="building" />
          </span>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 flex-1 min-w-0">
            <span className="font-bold text-headline whitespace-nowrap">{data.airline.name || ''}</span>
            {data.airline.note && (
              <span className="text-callout text-muted whitespace-nowrap">{data.airline.note}</span>
            )}
          </div>
        </div>
      )}
    </>
  );
}

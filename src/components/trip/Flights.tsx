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
            <div key={i} className="flight-row">
              <span className="flight-icon">
                {isReturn ? <Icon name="landing" /> : <Icon name="takeoff" />}
              </span>
              <div className="flight-info">
                {seg.label && (
                  <span className="flight-label">{seg.label}</span>
                )}
                {seg.flightNo && (
                  <span className="flight-route">{seg.flightNo}</span>
                )}
                {seg.route && (
                  <span className="flight-route">{seg.route}</span>
                )}
                {seg.time && (
                  <span className="flight-time">{seg.time}</span>
                )}
              </div>
            </div>
          );
        })}
      {data.airline && (
        <div className="flight-row">
          <span className="flight-icon">
            <Icon name="building" />
          </span>
          <div className="flight-info">
            <span className="flight-label">{data.airline.name || ''}</span>
            {data.airline.note && (
              <span className="flight-time">{data.airline.note}</span>
            )}
          </div>
        </div>
      )}
    </>
  );
}

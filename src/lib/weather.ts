/**
 * WMO weather code to icon name mapping and weather utility functions.
 */

/** WMO weather code => icon name mapping */
export const WMO: Record<number, string> = {
  0: 'weather-clear',
  1: 'weather-sun-cloud',
  2: 'weather-partly',
  3: 'weather-cloudy',
  45: 'weather-fog',
  48: 'weather-fog',
  51: 'weather-rain-sun',
  53: 'weather-rain-sun',
  55: 'weather-rain',
  56: 'weather-rain',
  57: 'weather-rain',
  61: 'weather-rain-sun',
  63: 'weather-rain',
  65: 'weather-rain',
  66: 'weather-rain',
  67: 'weather-rain',
  71: 'weather-snow',
  73: 'weather-snow',
  75: 'weather-snow',
  77: 'weather-snow',
  80: 'weather-rain-sun',
  81: 'weather-rain',
  82: 'weather-rain',
  85: 'weather-snow',
  86: 'weather-snow',
  95: 'weather-thunder',
  96: 'weather-thunder',
  99: 'weather-thunder',
};

/** A weather location entry with a name, coordinates, and start hour. */
export interface WeatherLocation {
  name: string;
  lat: number;
  lon: number;
  start: number;
}

/** Structure describing a day's weather locations and metadata. */
export interface WeatherDay {
  label: string;
  locations: WeatherLocation[];
}

/** Merged hourly weather data for a single day (24 values each). */
export interface MergedHourly {
  temps: number[];
  rains: number[];
  codes: number[];
}

/** Create a default (zeroed) merged hourly data object. */
export function makeDefaultMg(): MergedHourly {
  const mg: MergedHourly = { temps: [], rains: [], codes: [] };
  for (let h = 0; h < 24; h++) {
    mg.temps.push(0);
    mg.rains.push(0);
    mg.codes.push(0);
  }
  return mg;
}

/**
 * Given a WeatherDay and an hour, returns the index of the location
 * whose `start` hour is <= the given hour (searching from last to first).
 */
export function getLocIdx(day: WeatherDay, h: number): number {
  for (let i = day.locations.length - 1; i >= 0; i--) {
    if (h >= day.locations[i].start) return i;
  }
  return 0;
}

/**
 * Build a WeatherDay from day label + timeline entries.
 * Derives weather locations from entries that have coordinates + time.
 * Replaces the old weather_json column — no longer stored in DB.
 */
export function buildWeatherDay(
  dayLabel: string | null | undefined,
  timeline: Array<{ time?: string | null; title: string; location?: { lat?: number; lng?: number } | null }>,
): WeatherDay | null {
  if (!timeline || timeline.length === 0) return null;

  const locations: WeatherLocation[] = [];
  let lastLat = 0;
  let lastLon = 0;

  for (const entry of timeline) {
    const lat = entry.location?.lat;
    const lng = entry.location?.lng;
    if (typeof lat !== 'number' || typeof lng !== 'number') continue;

    // Skip if same location as previous (within ~1km)
    if (locations.length > 0 && Math.abs(lat - lastLat) < 0.01 && Math.abs(lng - lastLon) < 0.01) continue;

    // Parse start hour from time field (e.g., "09:00-11:00" → 9)
    let start = 0;
    if (entry.time) {
      const match = entry.time.match(/(\d{1,2}):/);
      if (match) start = parseInt(match[1], 10);
    }

    locations.push({ name: entry.title, lat, lon: lng, start });
    lastLat = lat;
    lastLon = lng;
  }

  if (locations.length === 0) return null;

  return {
    label: dayLabel || locations[0].name,
    locations,
  };
}

/** Format a date as "YYYY-MM-DD". */
export function toDateStr(d: Date): string {
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

/** Open-Meteo API hourly response shape (partial). */
interface OpenMeteoHourly {
  time: string[];
  temperature_2m: number[];
  precipitation_probability: number[];
  weather_code: number[];
}

interface OpenMeteoResponse {
  hourly?: OpenMeteoHourly;
}

/** In-memory cache for weather API responses keyed by "lat,lon". */
const weatherCache: Record<string, OpenMeteoResponse> = {};
const MAX_WEATHER_CACHE = 20;

/**
 * Fetches hourly weather from Open-Meteo for a given day.
 * Returns the merged hourly data, or a default (zeroed) set if out of range.
 */
export async function fetchWeatherForDay(
  dayDate: string,
  weatherDay: WeatherDay,
  tripStart?: string | null,
  tripEnd?: string | null,
  timezone: string = 'Asia/Tokyo',
): Promise<MergedHourly> {
  if (!weatherDay.locations || !weatherDay.locations.length) {
    return makeDefaultMg();
  }
  if (!dayDate || dayDate.indexOf('-') === -1) {
    return makeDefaultMg();
  }

  const MS_PER_DAY = 86400000;
  const todayD = new Date();
  todayD.setHours(0, 0, 0, 0);
  const limitD = new Date(todayD.getTime() + 16 * MS_PER_DAY);
  const fetchStart =
    tripStart && tripStart > toDateStr(todayD) ? tripStart : toDateStr(todayD);
  const fetchEnd =
    tripEnd && tripEnd < toDateStr(limitD) ? tripEnd : toDateStr(limitD);

  if (dayDate > fetchEnd || dayDate < fetchStart) {
    return makeDefaultMg();
  }

  // Collect unique coordinates
  const locKeys: string[] = [];
  weatherDay.locations.forEach((l) => {
    const k = l.lat + ',' + l.lon;
    if (locKeys.indexOf(k) === -1) locKeys.push(k);
  });

  // Fetch (with cache) for each unique coordinate
  const results: Record<string, OpenMeteoResponse> = {};
  await Promise.all(
    locKeys.map(async (k) => {
      if (weatherCache[k]) {
        results[k] = weatherCache[k];
        return;
      }
      const parts = k.split(',');
      const params = new URLSearchParams({
        latitude: parts[0],
        longitude: parts[1],
        hourly: 'temperature_2m,precipitation_probability,weather_code',
        start_date: fetchStart,
        end_date: fetchEnd,
        timezone,
      });
      const resp = await fetch(
        'https://api.open-meteo.com/v1/forecast?' + params.toString(),
      );
      if (!resp.ok) return null;
      const data = (await resp.json()) as OpenMeteoResponse;
      if (Object.keys(weatherCache).length >= MAX_WEATHER_CACHE) {
        delete weatherCache[Object.keys(weatherCache)[0]];
      }
      weatherCache[k] = data;
      results[k] = data;
    }),
  );

  const sample = results[locKeys[0]];
  if (!sample || !sample.hourly) return makeDefaultMg();

  const dayOffset = sample.hourly.time.indexOf(dayDate + 'T00:00');
  if (dayOffset < 0) return makeDefaultMg();

  const mg: MergedHourly = { temps: [], rains: [], codes: [] };
  for (let h = 0; h < 24; h++) {
    const li = getLocIdx(weatherDay, h);
    const l = weatherDay.locations[li];
    const d = results[l.lat + ',' + l.lon];
    const idx = dayOffset + h;
    if (d && d.hourly && idx < d.hourly.temperature_2m.length) {
      mg.temps.push(d.hourly.temperature_2m[idx]);
      mg.rains.push(d.hourly.precipitation_probability[idx]);
      mg.codes.push(d.hourly.weather_code[idx]);
    } else {
      mg.temps.push(0);
      mg.rains.push(0);
      mg.codes.push(0);
    }
  }
  return mg;
}

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve } from 'path';

const { validateTripData } = require('../../js/app.js');

const DIST_DIR = resolve(__dirname, '../../data/dist');

// 掃描 dist 子目錄（含 meta.json 的即為行程）
const slugs = readdirSync(DIST_DIR).filter((d) => {
  return existsSync(resolve(DIST_DIR, d, 'meta.json'));
});

/** 從 dist 分檔 JSON 組合完整行程物件 */
function loadDistTrip(slug) {
  const dir = resolve(DIST_DIR, slug);
  const meta = JSON.parse(readFileSync(resolve(dir, 'meta.json'), 'utf8'));
  const result = {
    meta: meta.meta,
    footer: meta.footer,
    autoScrollDates: meta.autoScrollDates,
  };

  const flightsPath = resolve(dir, 'flights.json');
  if (existsSync(flightsPath)) {
    result.flights = JSON.parse(readFileSync(flightsPath, 'utf8'));
  }

  const dayFiles = readdirSync(dir)
    .filter((f) => /^day-\d+\.json$/.test(f))
    .sort((a, b) => {
      const na = parseInt(a.match(/\d+/)[0], 10);
      const nb = parseInt(b.match(/\d+/)[0], 10);
      return na - nb;
    });
  result.days = dayFiles.map((f) => JSON.parse(readFileSync(resolve(dir, f), 'utf8')));

  const checklistPath = resolve(dir, 'checklist.json');
  if (existsSync(checklistPath)) {
    result.checklist = JSON.parse(readFileSync(checklistPath, 'utf8'));
  }

  const suggestionsPath = resolve(dir, 'suggestions.json');
  if (existsSync(suggestionsPath)) {
    result.suggestions = JSON.parse(readFileSync(suggestionsPath, 'utf8'));
  }

  const emergencyPath = resolve(dir, 'emergency.json');
  if (existsSync(emergencyPath)) {
    result.emergency = JSON.parse(readFileSync(emergencyPath, 'utf8'));
  }

  return result;
}

slugs.forEach((slug) => {
  describe(`JSON schema: ${slug}`, () => {
    let data;

    it('loads from dist JSON files', () => {
      data = loadDistTrip(slug);
      expect(data).toBeDefined();
    });

    it('passes validateTripData with zero errors and zero warnings', () => {
      const result = validateTripData(data);
      expect(result.errors, 'validation errors: ' + result.errors.join('; ')).toEqual([]);
      expect(result.warnings, 'validation warnings: ' + result.warnings.join('; ')).toEqual([]);
    });

    // --- 根層級必填欄位 ---

    it('has required root-level fields', () => {
      expect(data.meta).toBeDefined();
      expect(data.meta.title).toBeTruthy();
      expect(Array.isArray(data.days)).toBe(true);
      expect(data.days.length).toBeGreaterThan(0);
      expect(data.weather).toBeUndefined();
      expect(Array.isArray(data.autoScrollDates)).toBe(true);
      expect(data.autoScrollDates.length).toBeGreaterThan(0);
      expect(data.suggestions).toBeDefined();
      expect(data.checklist).toBeDefined();
    });

    // --- meta 欄位驗證 ---

    it('meta does not contain removed fields (themeColor)', () => {
      expect(data.meta.themeColor, 'meta.themeColor should not exist (moved to HTML)').toBeUndefined();
    });

    it('meta has name and owner from registry', () => {
      expect(typeof data.meta.name, 'meta.name must be a string').toBe('string');
      expect(data.meta.name.length, 'meta.name must not be empty').toBeGreaterThan(0);
      expect(typeof data.meta.owner, 'meta.owner must be a string').toBe('string');
      expect(data.meta.owner.length, 'meta.owner must not be empty').toBeGreaterThan(0);
    });

    // --- meta.selfDrive ---

    it('meta.selfDrive exists and is a boolean', () => {
      expect(data.meta.selfDrive, 'meta.selfDrive must exist').toBeDefined();
      expect(
        typeof data.meta.selfDrive === 'boolean',
        `meta.selfDrive must be boolean, got: ${typeof data.meta.selfDrive}`
      ).toBe(true);
    });

    // --- 每日結構 ---

    it('days have sequential IDs', () => {
      data.days.forEach((day, i) => {
        expect(Number(day.id)).toBe(i + 1);
      });
    });

    it('days have required fields (id, date, label, timeline)', () => {
      data.days.forEach((day, i) => {
        expect(day.id, `days[${i}] missing id`).toBeDefined();
        expect(day.date, `days[${i}] missing date`).toBeTruthy();
        expect(day.label, `days[${i}] missing label`).toBeDefined();
        expect(Array.isArray(day.content?.timeline), `days[${i}] missing timeline array`).toBe(true);
      });
    });

    // --- Hotel 結構 ---

    it('hotel objects have required fields (name, breakfast)', () => {
      data.days.forEach((day, i) => {
        const hotel = day.content?.hotel;
        if (!hotel) return;
        expect(hotel.name, `days[${i}].hotel missing name`).toBeTruthy();
        expect(hotel.breakfast, `days[${i}].hotel missing breakfast`).toBeDefined();
        expect(
          [true, false, null].includes(hotel.breakfast.included),
          `days[${i}].hotel.breakfast.included must be true/false/null, got: ${hotel.breakfast.included}`
        ).toBe(true);
      });
    });

    it('hotel optional fields have correct types when present', () => {
      data.days.forEach((day, i) => {
        const hotel = day.content?.hotel;
        if (!hotel) return;
        if (hotel.checkout !== undefined) expect(typeof hotel.checkout, `days[${i}].hotel.checkout`).toBe('string');
        if (hotel.details !== undefined) expect(Array.isArray(hotel.details), `days[${i}].hotel.details`).toBe(true);
        expect(hotel.subs, `days[${i}].hotel.subs should not exist (migrated to infoBoxes)`).toBeUndefined();
        if (hotel.infoBoxes !== undefined) expect(Array.isArray(hotel.infoBoxes), `days[${i}].hotel.infoBoxes`).toBe(true);
      });
    });

    it('hotel does not contain deprecated subs field', () => {
      data.days.forEach((day, i) => {
        const hotel = day.content?.hotel;
        if (!hotel) return;
        expect(hotel.subs, `days[${i}].hotel.subs should not exist (migrated to infoBoxes)`).toBeUndefined();
      });
    });

    // --- Timeline event 結構 ---

    it('timeline events have required fields (time, title)', () => {
      data.days.forEach((day, i) => {
        const timeline = day.content?.timeline || [];
        timeline.forEach((ev, j) => {
          expect(ev.time, `days[${i}].timeline[${j}] missing time`).toBeTruthy();
          expect(ev.title, `days[${i}].timeline[${j}] missing title`).toBeTruthy();
        });
      });
    });

    it('timeline optional fields have correct types when present', () => {
      data.days.forEach((day, i) => {
        const timeline = day.content?.timeline || [];
        timeline.forEach((ev, j) => {
          const prefix = `days[${i}].timeline[${j}]`;
          if (ev.description !== undefined) expect(typeof ev.description, `${prefix}.description`).toBe('string');
          if (ev.locations !== undefined) expect(Array.isArray(ev.locations), `${prefix}.locations`).toBe(true);
          if (ev.infoBoxes !== undefined) expect(Array.isArray(ev.infoBoxes), `${prefix}.infoBoxes`).toBe(true);
        });
      });
    });

    // --- Travel 結構 ---

    it('travel objects have text (string) and type (string)', () => {
      data.days.forEach((day, i) => {
        const timeline = day.content?.timeline || [];
        timeline.forEach((entry, j) => {
          if (!entry.travel) return;
          const prefix = `days[${i}].timeline[${j}].travel`;
          expect(typeof entry.travel.text, `${prefix}.text`).toBe('string');
          expect(typeof entry.travel.type, `${prefix}.type`).toBe('string');
        });
      });
    });

    // --- Restaurants infoBox 結構 ---

    it('restaurants infoBox items have required fields (name, hours, reservation)', () => {
      data.days.forEach((day, i) => {
        const timeline = day.content?.timeline || [];
        timeline.forEach((ev, j) => {
          (ev.infoBoxes || []).forEach((box, k) => {
            if (box.type !== 'restaurants') return;
            const prefix = `days[${i}].timeline[${j}].infoBoxes[${k}]`;
            expect(Array.isArray(box.restaurants), `${prefix}.restaurants`).toBe(true);
            box.restaurants.forEach((r, m) => {
              expect(r.name, `${prefix}.restaurants[${m}].name`).toBeTruthy();
              expect(r.hours, `${prefix}.restaurants[${m}].hours`).toBeTruthy();
              expect(r.reservation !== undefined, `${prefix}.restaurants[${m}].reservation must exist`).toBe(true);
            });
          });
        });
        // Also check hotel infoBoxes
        const hotel = day.content?.hotel;
        if (hotel?.infoBoxes) {
          hotel.infoBoxes.forEach((box, k) => {
            if (box.type !== 'restaurants') return;
            const prefix = `days[${i}].hotel.infoBoxes[${k}]`;
            expect(Array.isArray(box.restaurants), `${prefix}.restaurants`).toBe(true);
            box.restaurants.forEach((r, m) => {
              expect(r.name, `${prefix}.restaurants[${m}].name`).toBeTruthy();
              expect(r.hours, `${prefix}.restaurants[${m}].hours`).toBeTruthy();
              expect(r.reservation !== undefined, `${prefix}.restaurants[${m}].reservation must exist`).toBe(true);
            });
          });
        }
      });
    });

    // --- Shopping infoBox 結構 ---

    it('shopping infoBox items have required fields (category, name, hours, mustBuy)', () => {
      data.days.forEach((day, i) => {
        const timeline = day.content?.timeline || [];
        timeline.forEach((ev, j) => {
          (ev.infoBoxes || []).forEach((box, k) => {
            if (box.type !== 'shopping') return;
            const prefix = `days[${i}].timeline[${j}].infoBoxes[${k}]`;
            expect(Array.isArray(box.shops), `${prefix}.shops`).toBe(true);
            box.shops.forEach((s, m) => {
              expect(s.category, `${prefix}.shops[${m}].category`).toBeTruthy();
              expect(s.name, `${prefix}.shops[${m}].name`).toBeTruthy();
              expect(s.hours, `${prefix}.shops[${m}].hours`).toBeTruthy();
              expect(Array.isArray(s.mustBuy), `${prefix}.shops[${m}].mustBuy`).toBe(true);
            });
          });
        });
        // Also check hotel infoBoxes
        const hotel = day.content?.hotel;
        if (hotel?.infoBoxes) {
          hotel.infoBoxes.forEach((box, k) => {
            if (box.type !== 'shopping') return;
            const prefix = `days[${i}].hotel.infoBoxes[${k}]`;
            expect(Array.isArray(box.shops), `${prefix}.shops`).toBe(true);
            box.shops.forEach((s, m) => {
              expect(s.category, `${prefix}.shops[${m}].category`).toBeTruthy();
              expect(s.name, `${prefix}.shops[${m}].name`).toBeTruthy();
              expect(s.hours, `${prefix}.shops[${m}].hours`).toBeTruthy();
              expect(Array.isArray(s.mustBuy), `${prefix}.shops[${m}].mustBuy`).toBe(true);
            });
          });
        }
      });
    });

    // --- gasStation infoBox 結構 ---

    it('gasStation infoBox has valid station object with required fields', () => {
      data.days.forEach((day, i) => {
        const timeline = day.content?.timeline || [];
        timeline.forEach((ev, j) => {
          (ev.infoBoxes || []).forEach((box, k) => {
            if (box.type !== 'gasStation') return;
            const prefix = `days[${i}].timeline[${j}].infoBoxes[${k}]`;
            expect(box.station, `${prefix} missing station object`).toBeDefined();
            expect(typeof box.station.name, `${prefix}.station.name`).toBe('string');
            expect(typeof box.station.address, `${prefix}.station.address`).toBe('string');
            expect(typeof box.station.hours, `${prefix}.station.hours`).toBe('string');
            expect(typeof box.station.service, `${prefix}.station.service`).toBe('string');
            expect(typeof box.station.phone, `${prefix}.station.phone`).toBe('string');
            if (box.station.location) {
              expect(typeof box.station.location.name, `${prefix}.station.location.name`).toBe('string');
              expect(typeof box.station.location.googleQuery, `${prefix}.station.location.googleQuery`).toBe('string');
              expect(typeof box.station.location.appleQuery, `${prefix}.station.location.appleQuery`).toBe('string');
            }
          });
        });
      });
    });

    // --- R13 source 欄位 ---

    it('R13: non-exempt POIs have source field with valid value ("user"|"ai")', () => {
      const validSources = ['user', 'ai'];

      data.days.forEach((day, i) => {
        const timeline = day.content?.timeline || [];

        const hotel = day.content?.hotel;
        if (hotel && hotel.name !== '家' && !hotel.name.startsWith('（')) {
          expect(
            validSources.includes(hotel.source),
            `days[${i}].hotel "${hotel.name}" source must be "user" or "ai", got: ${hotel.source}`
          ).toBe(true);
        }

        timeline.forEach((ev, j) => {
          if (ev.travel) return;
          if ((ev.title || '').includes('餐廳未定')) return;
          const prefix = `days[${i}].timeline[${j}]`;

          expect(
            validSources.includes(ev.source),
            `${prefix} "${ev.title}" source must be "user" or "ai", got: ${ev.source}`
          ).toBe(true);

          (ev.infoBoxes || []).forEach((box, k) => {
            if (box.type === 'restaurants') {
              (box.restaurants || []).forEach((r, m) => {
                expect(
                  validSources.includes(r.source),
                  `${prefix}.infoBoxes[${k}].restaurants[${m}] "${r.name}" source must be "user" or "ai", got: ${r.source}`
                ).toBe(true);
              });
            }
            if (box.type === 'shopping') {
              (box.shops || []).forEach((s, m) => {
                expect(
                  validSources.includes(s.source),
                  `${prefix}.infoBoxes[${k}].shops[${m}] "${s.name}" source must be "user" or "ai", got: ${s.source}`
                ).toBe(true);
              });
            }
            if (box.type === 'gasStation' && box.station) {
              expect(
                validSources.includes(box.station.source),
                `${prefix}.infoBoxes[${k}].station "${box.station.name}" source must be "user" or "ai", got: ${box.station.source}`
              ).toBe(true);
            }
          });
        });

        if (hotel?.infoBoxes) {
          hotel.infoBoxes.forEach((box, k) => {
            if (box.type === 'restaurants') {
              (box.restaurants || []).forEach((r, m) => {
                expect(
                  validSources.includes(r.source),
                  `days[${i}].hotel.infoBoxes[${k}].restaurants[${m}] "${r.name}" source must be "user" or "ai", got: ${r.source}`
                ).toBe(true);
              });
            }
            if (box.type === 'shopping') {
              (box.shops || []).forEach((s, m) => {
                expect(
                  validSources.includes(s.source),
                  `days[${i}].hotel.infoBoxes[${k}].shops[${m}] "${s.name}" source must be "user" or "ai", got: ${s.source}`
                ).toBe(true);
              });
            }
          });
        }
      });
    });

    // --- Flights 結構（選填） ---

    it('flights structure is valid when present', () => {
      if (!data.flights) return;
      expect(data.flights.title).toBeTruthy();
      expect(data.flights.content).toBeDefined();
      const segments = data.flights.content.segments;
      expect(Array.isArray(segments)).toBe(true);
      segments.forEach((seg, i) => {
        expect(seg.label, `segment[${i}].label`).toBeTruthy();
        expect(seg.route, `segment[${i}].route`).toBeTruthy();
        const hasTime = typeof seg.time === 'string';
        const hasStructured = typeof seg.depart === 'string' && typeof seg.arrive === 'string';
        expect(hasTime || hasStructured, `segment[${i}] must have time or depart+arrive`).toBe(true);
      });
    });

    // --- 保留原有測試 ---

    it('each day has valid weather with numeric lat/lon', () => {
      data.days.forEach((day, i) => {
        if (day.weather) {
          expect(typeof day.weather.label).toBe('string');
          expect(Array.isArray(day.weather.locations)).toBe(true);
          day.weather.locations.forEach((loc, j) => {
            expect(typeof loc.lat).toBe('number');
            expect(typeof loc.lon).toBe('number');
            expect(typeof loc.name).toBe('string');
            expect(typeof loc.start).toBe('number');
            expect(typeof loc.end).toBe('number');
          });
        }
      });
    });

    it('autoScrollDates are ISO format', () => {
      data.autoScrollDates.forEach((d) => {
        expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });
  });
});

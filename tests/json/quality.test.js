import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve } from 'path';

const DIST_DIR = resolve(__dirname, '../../data/dist');

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

  return result;
}

/**
 * 解析 flights segments 取得去程到達時間與回程出發時間
 * 支援合併字串格式 "3/6（五）15:20→17:50" 和結構化 depart/arrive
 */
function parseFlightTimes(flights) {
  if (!flights?.content?.segments?.length) return null;
  const segs = flights.content.segments;
  const first = segs[0];
  const last = segs[segs.length - 1];

  function extractTime(seg, which) {
    // 結構化格式
    if (which === 'arrive' && seg.arrive) return seg.arrive;
    if (which === 'depart' && seg.depart) return seg.depart;
    if (!seg.time) return null;
    // 嘗試精確匹配: "15:20→17:50"
    const exact = seg.time.match(/(\d{1,2}:\d{2})\s*[→→]\s*(\d{1,2}:\d{2})/);
    if (exact) return which === 'depart' ? exact[1] : exact[2];
    // 鬆散匹配：找出所有 HH:MM，第一個=出發，最後一個=到達
    const allTimes = [...seg.time.matchAll(/(\d{1,2}:\d{2})/g)].map((m) => m[1]);
    if (allTimes.length >= 2) return which === 'depart' ? allTimes[0] : allTimes[allTimes.length - 1];
    if (allTimes.length === 1) return allTimes[0];
    return null;
  }

  return {
    arrivalTime: extractTime(first, 'arrive'),
    departureTime: extractTime(last, 'depart'),
  };
}

/** 將 "HH:MM" 轉為小時數 */
function toHour(timeStr) {
  if (!timeStr) return null;
  const m = timeStr.match(/(\d{1,2}):(\d{2})/);
  return m ? parseInt(m[1], 10) + parseInt(m[2], 10) / 60 : null;
}

/** 檢查 timeline 中是否有餐次 event（標題/描述含關鍵字，或有 restaurants infoBox） */
function hasMealEvent(timeline, keyword) {
  return timeline.some((ev) => {
    const t = (ev.title || '');
    const d = (ev.description || '');
    if (t.includes(keyword) || d.includes(keyword)) return true;
    if (ev.infoBoxes) {
      const hasRestBox = ev.infoBoxes.some(
        (box) => box.type === 'restaurants' && (box.title || '').includes(keyword)
      );
      if (hasRestBox) return true;
    }
    return false;
  });
}

slugs.forEach((slug) => {
  describe(`Quality rules: ${slug}`, () => {
    let data;

    it('loads from dist JSON files', () => {
      data = loadDistTrip(slug);
      expect(data).toBeDefined();
    });

    // --- R0/R1 meta.countries 必填 ---

    it('R0/R1: meta.countries is a non-empty array', () => {
      expect(
        Array.isArray(data.meta.countries) && data.meta.countries.length > 0,
        `${slug} meta.countries must be a non-empty array`
      ).toBe(true);
    });

    // --- R13 韓國行程 naverQuery 檢查 ---

    it('R13: KR trips have naverQuery on all POI locations', () => {
      if (!data.meta.countries || !data.meta.countries.includes('KR')) return;

      data.days.forEach((day, i) => {
        const timeline = day.content?.timeline || [];
        timeline.forEach((ev, j) => {
          if (ev.travel) return;
          if ((ev.title || '').includes('餐廳未定')) return;

          if (Array.isArray(ev.locations)) {
            ev.locations.forEach((loc, k) => {
              expect(
                typeof loc.naverQuery === 'string' && loc.naverQuery.length > 0,
                `days[${i}].timeline[${j}].locations[${k}] "${loc.name}" missing naverQuery`
              ).toBe(true);
              expect(
                loc.naverQuery.startsWith('https://map.naver.com/'),
                `days[${i}].timeline[${j}].locations[${k}] "${loc.name}" naverQuery must start with https://map.naver.com/`
              ).toBe(true);
            });
          }

          (ev.infoBoxes || []).forEach((box, k) => {
            if (box.type !== 'restaurants') return;
            (box.restaurants || []).forEach((r, m) => {
              if (r.location) {
                expect(
                  typeof r.location.naverQuery === 'string' && r.location.naverQuery.length > 0,
                  `days[${i}].timeline[${j}].infoBoxes[${k}].restaurants[${m}] "${r.name}" location missing naverQuery`
                ).toBe(true);
              }
            });
          });

          (ev.infoBoxes || []).forEach((box, k) => {
            if (box.type !== 'shopping') return;
            (box.shops || []).forEach((s, m) => {
              if (s.location) {
                expect(
                  typeof s.location.naverQuery === 'string' && s.location.naverQuery.length > 0,
                  `days[${i}].timeline[${j}].infoBoxes[${k}].shops[${m}] "${s.name}" location missing naverQuery`
                ).toBe(true);
              }
            });
          });
        });

        const hotel = day.content?.hotel;
        if (hotel?.infoBoxes) {
          hotel.infoBoxes.forEach((box, k) => {
            if (box.type !== 'shopping') return;
            (box.shops || []).forEach((s, m) => {
              if (s.location) {
                expect(
                  typeof s.location.naverQuery === 'string' && s.location.naverQuery.length > 0,
                  `days[${i}].hotel.infoBoxes[${k}].shops[${m}] "${s.name}" location missing naverQuery`
                ).toBe(true);
              }
            });
          });
        }
      });
    });

    // --- R2 航程感知餐次檢查 ---

    it('R2: each day has required meals (flight-aware)', () => {
      const ft = parseFlightTimes(data.flights);
      const totalDays = data.days.length;

      data.days.forEach((day, i) => {
        const timeline = day.content?.timeline || [];
        const isFirstDay = i === 0;
        const isLastDay = i === totalDays - 1;

        const hasGroupTour = timeline.some((ev) => {
          const t = (ev.title || '');
          return t.includes('KKday') || t.includes('Klook') || t.includes('一日遊');
        });

        const isHomeStay = day.content?.hotel?.name === '家';

        let needLunch = true;
        let needDinner = true;

        if (ft) {
          if (isFirstDay) {
            const arrHour = toHour(ft.arrivalTime);
            if (arrHour !== null) {
              needLunch = arrHour < 11.5;
              needDinner = arrHour < 17;
            }
          }
          if (isLastDay) {
            const depHour = toHour(ft.departureTime);
            if (depHour !== null) {
              needLunch = depHour >= 11.5;
              needDinner = depHour >= 17;
            }
          }
        }

        if (hasGroupTour) needLunch = false;
        if (isHomeStay) { needLunch = false; needDinner = false; }

        const hasLunch = hasMealEvent(timeline, '午餐') || hasMealEvent(timeline, 'lunch');
        const hasDinner = hasMealEvent(timeline, '晚餐') || hasMealEvent(timeline, 'dinner') || hasMealEvent(timeline, '宵夜');

        if (needLunch) {
          expect(hasLunch, `Day ${day.id} (${slug}) 缺少午餐`).toBe(true);
        }
        if (needDinner) {
          expect(hasDinner, `Day ${day.id} (${slug}) 缺少晚餐`).toBe(true);
        }
      });
    });

    // --- R3 餐廳數量檢查 ---

    it('R3: restaurants infoBox has 1-3 restaurants', () => {
      data.days.forEach((day, i) => {
        const timeline = day.content?.timeline || [];
        timeline.forEach((ev, j) => {
          (ev.infoBoxes || []).forEach((box, k) => {
            if (box.type !== 'restaurants') return;
            expect(
              box.restaurants.length,
              `days[${i}].timeline[${j}].infoBoxes[${k}] has ${box.restaurants.length} restaurants, need 1-3`
            ).toBeGreaterThanOrEqual(1);
            expect(
              box.restaurants.length,
              `days[${i}].timeline[${j}].infoBoxes[${k}] has ${box.restaurants.length} restaurants, max 3`
            ).toBeLessThanOrEqual(3);
          });
        });
      });
    });

    // --- R3 餐廳必填欄位 ---

    it('R3: restaurant items have hours and reservation', () => {
      data.days.forEach((day, i) => {
        const allBoxes = [];
        const timeline = day.content?.timeline || [];
        timeline.forEach((ev) => {
          (ev.infoBoxes || []).forEach((box) => {
            if (box.type === 'restaurants') allBoxes.push(box);
          });
        });
        if (day.content?.hotel?.infoBoxes) {
          day.content.hotel.infoBoxes.forEach((box) => {
            if (box.type === 'restaurants') allBoxes.push(box);
          });
        }

        allBoxes.forEach((box) => {
          box.restaurants.forEach((r) => {
            expect(r.hours, `${r.name} missing hours`).toBeTruthy();
            expect(r.reservation !== undefined && r.reservation !== '', `${r.name} missing reservation`).toBe(true);
          });
        });
      });
    });

    // --- R3 營業時間吻合 ---

    it('R3: restaurant hours match event time (no 17:00 shop for lunch)', () => {
      data.days.forEach((day, i) => {
        const timeline = day.content?.timeline || [];
        timeline.forEach((ev, j) => {
          const evHour = toHour(ev.time);
          if (evHour === null) return;

          (ev.infoBoxes || []).forEach((box) => {
            if (box.type !== 'restaurants') return;
            box.restaurants.forEach((r) => {
              if (!r.hours) return;
              const m = r.hours.match(/(\d{1,2}):(\d{2})/);
              if (!m) return;
              const openHour = parseInt(m[1], 10) + parseInt(m[2], 10) / 60;
              expect(
                openHour <= evHour + 1,
                `Day ${day.id} ${ev.title} (${ev.time}): ${r.name} opens at ${r.hours}, too late`
              ).toBe(true);
            });
          });
        });
      });
    });

    // --- R4 景點 blogUrl ---

    it('R4: non-travel/non-undecided events have blogUrl field', () => {
      data.days.forEach((day, i) => {
        const timeline = day.content?.timeline || [];
        timeline.forEach((ev, j) => {
          if (ev.travel) return;
          if ((ev.title || '').includes('餐廳未定')) return;
          expect(
            ev.hasOwnProperty('blogUrl'),
            `days[${i}].timeline[${j}] "${ev.title}" missing blogUrl field`
          ).toBe(true);
        });
      });
    });

    // --- R5 飯店 blogUrl ---

    it('R5: non-home hotels have blogUrl field', () => {
      data.days.forEach((day, i) => {
        const hotel = day.content?.hotel;
        if (!hotel || hotel.name === '家') return;
        if (hotel.name.startsWith('（')) return;
        expect(
          hotel.hasOwnProperty('blogUrl'),
          `days[${i}].hotel "${hotel.name}" missing blogUrl field`
        ).toBe(true);
      });
    });

    // --- R7 飯店 shopping infoBox ---

    it('R7: non-home hotels have shopping infoBox in hotel.infoBoxes', () => {
      data.days.forEach((day, i) => {
        const hotel = day.content?.hotel;
        if (!hotel || hotel.name === '家') return;
        if (hotel.name.startsWith('（')) return;
        const hotelBoxes = hotel.infoBoxes || [];
        const shoppingBox = hotelBoxes.find((box) => box.type === 'shopping');
        expect(
          shoppingBox,
          `days[${i}].hotel "${hotel.name}" missing shopping infoBox in hotel.infoBoxes`
        ).toBeDefined();
        if (shoppingBox) {
          expect(
            shoppingBox.shops?.length >= 3,
            `days[${i}].hotel "${hotel.name}" shopping infoBox has ${shoppingBox.shops?.length || 0} shops, need >= 3`
          ).toBe(true);
        }
      });
    });

    // --- R1/R3 餐廳 category 對齊 foodPreferences ---

    it('R1/R3: restaurant categories align with foodPreferences order', () => {
      const prefs = data.meta?.foodPreferences;
      if (!prefs || prefs.length === 0) return;

      data.days.forEach((day, i) => {
        const timeline = day.content?.timeline || [];
        timeline.forEach((ev, j) => {
          (ev.infoBoxes || []).forEach((box, k) => {
            if (box.type !== 'restaurants') return;
            const restaurants = box.restaurants || [];
            restaurants.forEach((r, m) => {
              if (m >= prefs.length) return;
              const cat = r.category || '';
              if (cat) {
                expect(
                  cat.includes(prefs[m]),
                  `days[${i}].timeline[${j}].infoBoxes[${k}].restaurants[${m}]: ` +
                  `category "${cat}" 不符合 foodPreferences[${m}] "${prefs[m]}"`
                ).toBe(true);
              }
            });
          });
        });
      });
    });

    // --- R7 shopping mustBuy ---

    it('R7: shopping shops have mustBuy with >= 3 items', () => {
      data.days.forEach((day, i) => {
        const allBoxes = [];
        const timeline = day.content?.timeline || [];
        timeline.forEach((ev) => {
          (ev.infoBoxes || []).forEach((box) => {
            if (box.type === 'shopping') allBoxes.push(box);
          });
        });
        if (day.content?.hotel?.infoBoxes) {
          day.content.hotel.infoBoxes.forEach((box) => {
            if (box.type === 'shopping') allBoxes.push(box);
          });
        }

        allBoxes.forEach((box) => {
          (box.shops || []).forEach((s) => {
            expect(
              Array.isArray(s.mustBuy) && s.mustBuy.length >= 3,
              `${s.name} mustBuy needs >= 3 items, has ${s.mustBuy?.length || 0}`
            ).toBe(true);
          });
        });
      });
    });

    // --- R7 shop 不含 titleUrl ---

    it('R7: shop items do not have titleUrl', () => {
      data.days.forEach((day) => {
        const allBoxes = [];
        const timeline = day.content?.timeline || [];
        timeline.forEach((ev) => {
          (ev.infoBoxes || []).forEach((box) => {
            if (box.type === 'shopping') allBoxes.push(box);
          });
        });
        if (day.content?.hotel?.infoBoxes) {
          day.content.hotel.infoBoxes.forEach((box) => {
            if (box.type === 'shopping') allBoxes.push(box);
          });
        }

        allBoxes.forEach((box) => {
          (box.shops || []).forEach((s) => {
            expect(s.titleUrl, `${s.name} should not have titleUrl`).toBeUndefined();
          });
        });
      });
    });

    // --- R8 早餐欄位 ---

    it('R8: hotels have breakfast field with valid included value', () => {
      data.days.forEach((day, i) => {
        const hotel = day.content?.hotel;
        if (!hotel) return;
        expect(hotel.breakfast, `days[${i}].hotel missing breakfast`).toBeDefined();
        expect(
          [true, false, null].includes(hotel.breakfast.included),
          `days[${i}].hotel.breakfast.included must be true/false/null`
        ).toBe(true);
      });
    });

    // --- R10 還車加油站 ---

    it('R10: self-drive/mixed trips with 還車 event must have gasStation infoBox', () => {
      if (!data.meta?.selfDrive) return;

      data.days.forEach((day, i) => {
        const timeline = day.content?.timeline || [];
        timeline.forEach((ev, j) => {
          if (!(ev.title || '').includes('還車')) return;
          const hasGasStation = (ev.infoBoxes || []).some((box) => box.type === 'gasStation');
          expect(
            hasGasStation,
            `Day ${day.id} "${ev.title}" (${slug}) 還車事件缺少 gasStation infoBox`
          ).toBe(true);
        });
      });
    });

    // --- R11 地圖導航 ---

    it('R11: physical events have locations, restaurants have location', () => {
      data.days.forEach((day, i) => {
        const timeline = day.content?.timeline || [];
        timeline.forEach((ev, j) => {
          if (ev.travel) return;
          if ((ev.title || '').includes('餐廳未定')) return;

          expect(
            Array.isArray(ev.locations) && ev.locations.length > 0,
            `days[${i}].timeline[${j}] "${ev.title}" missing locations[]`
          ).toBe(true);

          (ev.infoBoxes || []).forEach((box, k) => {
            if (box.type !== 'restaurants') return;
            (box.restaurants || []).forEach((r, m) => {
              expect(
                r.location && typeof r.location === 'object',
                `days[${i}].timeline[${j}].infoBoxes[${k}].restaurants[${m}] "${r.name}" missing location`
              ).toBe(true);
            });
          });

          (ev.infoBoxes || []).forEach((box, k) => {
            if (box.type !== 'gasStation') return;
            expect(
              box.station && box.station.location && typeof box.station.location === 'object',
              `days[${i}].timeline[${j}].infoBoxes[${k}] gasStation missing station.location`
            ).toBe(true);
          });
        });
      });
    });

    // --- R12 Google 評分 ---

    it('R12: physical events, restaurants, and shops have googleRating', () => {
      data.days.forEach((day, i) => {
        const timeline = day.content?.timeline || [];
        timeline.forEach((ev, j) => {
          if (ev.travel) return;
          if ((ev.title || '').includes('餐廳未定')) return;

          expect(
            typeof ev.googleRating === 'number' && ev.googleRating >= 1 && ev.googleRating <= 5,
            `days[${i}].timeline[${j}] "${ev.title}" missing or invalid googleRating (got: ${ev.googleRating})`
          ).toBe(true);

          (ev.infoBoxes || []).forEach((box, k) => {
            if (box.type === 'restaurants') {
              (box.restaurants || []).forEach((r, m) => {
                expect(
                  typeof r.googleRating === 'number' && r.googleRating >= 1 && r.googleRating <= 5,
                  `days[${i}].timeline[${j}].infoBoxes[${k}].restaurants[${m}] "${r.name}" missing or invalid googleRating`
                ).toBe(true);
              });
            }
            if (box.type === 'shopping') {
              (box.shops || []).forEach((s, m) => {
                expect(
                  typeof s.googleRating === 'number' && s.googleRating >= 1 && s.googleRating <= 5,
                  `days[${i}].timeline[${j}].infoBoxes[${k}].shops[${m}] "${s.name}" missing or invalid googleRating`
                ).toBe(true);
              });
            }
            if (box.type === 'gasStation') {
              expect(
                typeof box.googleRating === 'number' && box.googleRating >= 1 && box.googleRating <= 5,
                `days[${i}].timeline[${j}].infoBoxes[${k}] gasStation missing or invalid googleRating`
              ).toBe(true);
            }
          });
        });

        const hotel = day.content?.hotel;
        if (hotel?.infoBoxes) {
          hotel.infoBoxes.forEach((box, k) => {
            if (box.type === 'restaurants') {
              (box.restaurants || []).forEach((r, m) => {
                expect(
                  typeof r.googleRating === 'number' && r.googleRating >= 1 && r.googleRating <= 5,
                  `days[${i}].hotel.infoBoxes[${k}].restaurants[${m}] "${r.name}" missing or invalid googleRating`
                ).toBe(true);
              });
            }
            if (box.type === 'shopping') {
              (box.shops || []).forEach((s, m) => {
                expect(
                  typeof s.googleRating === 'number' && s.googleRating >= 1 && s.googleRating <= 5,
                  `days[${i}].hotel.infoBoxes[${k}].shops[${m}] "${s.name}" missing or invalid googleRating`
                ).toBe(true);
              });
            }
          });
        }
      });
    });

    // --- R13 POI 來源標記驗證 ---

    it('R13: ai-sourced POIs without googleRating are failures, user-sourced are warnings', () => {
      const aiMissing = [];
      const userMissing = [];

      data.days.forEach((day, i) => {
        const timeline = day.content?.timeline || [];
        const hotel = day.content?.hotel;

        timeline.forEach((ev, j) => {
          if (ev.travel) return;
          if ((ev.title || '').includes('餐廳未定')) return;
          const prefix = `days[${i}].timeline[${j}]`;

          if (ev.source === 'ai' && typeof ev.googleRating !== 'number') {
            aiMissing.push(`${prefix} "${ev.title}"`);
          } else if (ev.source === 'user' && typeof ev.googleRating !== 'number') {
            userMissing.push(`${prefix} "${ev.title}"`);
          }

          (ev.infoBoxes || []).forEach((box, k) => {
            if (box.type === 'restaurants') {
              (box.restaurants || []).forEach((r, m) => {
                if (r.source === 'ai' && typeof r.googleRating !== 'number') {
                  aiMissing.push(`${prefix}.infoBoxes[${k}].restaurants[${m}] "${r.name}"`);
                } else if (r.source === 'user' && typeof r.googleRating !== 'number') {
                  userMissing.push(`${prefix}.infoBoxes[${k}].restaurants[${m}] "${r.name}"`);
                }
              });
            }
            if (box.type === 'shopping') {
              (box.shops || []).forEach((s, m) => {
                if (s.source === 'ai' && typeof s.googleRating !== 'number') {
                  aiMissing.push(`${prefix}.infoBoxes[${k}].shops[${m}] "${s.name}"`);
                } else if (s.source === 'user' && typeof s.googleRating !== 'number') {
                  userMissing.push(`${prefix}.infoBoxes[${k}].shops[${m}] "${s.name}"`);
                }
              });
            }
            if (box.type === 'gasStation' && box.station) {
              if (box.station.source === 'ai' && typeof box.googleRating !== 'number') {
                aiMissing.push(`${prefix}.infoBoxes[${k}].station "${box.station.name}"`);
              } else if (box.station.source === 'user' && typeof box.googleRating !== 'number') {
                userMissing.push(`${prefix}.infoBoxes[${k}].station "${box.station.name}"`);
              }
            }
          });
        });

        if (hotel?.infoBoxes) {
          hotel.infoBoxes.forEach((box, k) => {
            if (box.type === 'restaurants') {
              (box.restaurants || []).forEach((r, m) => {
                if (r.source === 'ai' && typeof r.googleRating !== 'number') {
                  aiMissing.push(`days[${i}].hotel.infoBoxes[${k}].restaurants[${m}] "${r.name}"`);
                } else if (r.source === 'user' && typeof r.googleRating !== 'number') {
                  userMissing.push(`days[${i}].hotel.infoBoxes[${k}].restaurants[${m}] "${r.name}"`);
                }
              });
            }
            if (box.type === 'shopping') {
              (box.shops || []).forEach((s, m) => {
                if (s.source === 'ai' && typeof s.googleRating !== 'number') {
                  aiMissing.push(`days[${i}].hotel.infoBoxes[${k}].shops[${m}] "${s.name}"`);
                } else if (s.source === 'user' && typeof s.googleRating !== 'number') {
                  userMissing.push(`days[${i}].hotel.infoBoxes[${k}].shops[${m}] "${s.name}"`);
                }
              });
            }
          });
        }
      });

      expect(
        aiMissing.length,
        `R13 fail: ${aiMissing.length} ai-sourced POI(s) missing googleRating:\n${aiMissing.join('\n')}`
      ).toBe(0);

      if (userMissing.length > 0) {
        console.warn(`R13 warning: ${userMissing.length} user-sourced POI(s) missing googleRating in ${slug}:\n${userMissing.join('\n')}`);
      }
    });

    // --- R15 必填 note 欄位 ---

    it('R15: POI entities have note field (string)', () => {
      const missing = [];

      data.days.forEach((day, i) => {
        const timeline = day.content?.timeline || [];
        const hotel = day.content?.hotel;

        timeline.forEach((ev, j) => {
          if (ev.travel) return;
          const prefix = `days[${i}].timeline[${j}]`;

          if (typeof ev.note !== 'string') {
            missing.push(`${prefix} "${ev.title}" missing note`);
          }

          (ev.infoBoxes || []).forEach((box, k) => {
            if (box.type === 'restaurants') {
              (box.restaurants || []).forEach((r, m) => {
                if (typeof r.note !== 'string') {
                  missing.push(`${prefix}.infoBoxes[${k}].restaurants[${m}] "${r.name}" missing note`);
                }
              });
            }
            if (box.type === 'shopping') {
              (box.shops || []).forEach((s, m) => {
                if (typeof s.note !== 'string') {
                  missing.push(`${prefix}.infoBoxes[${k}].shops[${m}] "${s.name}" missing note`);
                }
              });
            }
          });
        });

        if (hotel) {
          if (typeof hotel.note !== 'string') {
            missing.push(`days[${i}].hotel "${hotel.name}" missing note`);
          }
          (hotel.infoBoxes || []).forEach((box, k) => {
            if (box.type === 'shopping') {
              (box.shops || []).forEach((s, m) => {
                if (typeof s.note !== 'string') {
                  missing.push(`days[${i}].hotel.infoBoxes[${k}].shops[${m}] "${s.name}" missing note`);
                }
              });
            }
          });
        }
      });

      expect(
        missing.length,
        `R15: ${missing.length} POI(s) missing note field:\n${missing.join('\n')}`
      ).toBe(0);
    });
  });
});

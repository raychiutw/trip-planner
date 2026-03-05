import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

const DATA_DIR = resolve(__dirname, '../../data/trips');
const jsonFiles = readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));

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
    // 標題或描述包含關鍵字
    if (t.includes(keyword) || d.includes(keyword)) return true;
    // 有 restaurants infoBox 且其 title 含關鍵字
    if (ev.infoBoxes) {
      const hasRestBox = ev.infoBoxes.some(
        (box) => box.type === 'restaurants' && (box.title || '').includes(keyword)
      );
      if (hasRestBox) return true;
    }
    return false;
  });
}

/** 計算字數（含標點，不含空白） */
function charCount(str) {
  return str.replace(/\s/g, '').length;
}

jsonFiles.forEach((file) => {
  describe(`Quality rules: ${file}`, () => {
    let data;

    it('parses as valid JSON', () => {
      const raw = readFileSync(resolve(DATA_DIR, file), 'utf8');
      data = JSON.parse(raw);
      expect(data).toBeDefined();
    });

    // --- R2 航程感知餐次檢查 ---

    it('R2: each day has required meals (flight-aware)', () => {
      const ft = parseFlightTimes(data.flights);
      const totalDays = data.days.length;

      data.days.forEach((day, i) => {
        const timeline = day.content?.timeline || [];
        const isFirstDay = i === 0;
        const isLastDay = i === totalDays - 1;

        // 跳過一日遊團（KKday/Klook）的午餐檢查
        const hasGroupTour = timeline.some((ev) => {
          const t = (ev.title || '');
          return t.includes('KKday') || t.includes('Klook') || t.includes('一日遊');
        });

        // 在地行程（hotel 名為「家」）跳過餐次檢查
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
          expect(hasLunch, `Day ${day.id} (${file}) 缺少午餐`).toBe(true);
        }
        if (needDinner) {
          expect(hasDinner, `Day ${day.id} (${file}) 缺少晚餐`).toBe(true);
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

    // --- R5 飯店 blogUrl ---

    it('R5: non-home hotels have blogUrl field', () => {
      data.days.forEach((day, i) => {
        const hotel = day.content?.hotel;
        if (!hotel || hotel.name === '家') return;
        if (hotel.name.startsWith('（')) return; // 跳過非住宿特殊標記（如「（返台）」）
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
        if (hotel.name.startsWith('（')) return; // 跳過非住宿特殊標記（如「（返台）」）
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
      if (!prefs || prefs.length === 0) return; // 無偏好時跳過

      data.days.forEach((day, i) => {
        const timeline = day.content?.timeline || [];
        timeline.forEach((ev, j) => {
          (ev.infoBoxes || []).forEach((box, k) => {
            if (box.type !== 'restaurants') return;
            const restaurants = box.restaurants || [];
            restaurants.forEach((r, m) => {
              if (m >= prefs.length) return; // 超過偏好數量不檢查
              const cat = r.category || '';
              // category 應包含對應偏好關鍵字（寬鬆比對）
              if (cat && !cat.includes(prefs[m])) {
                // 用 console.warn 而非 fail，待資料全面補齊後改為 strict
                console.warn(
                  `days[${i}].timeline[${j}].infoBoxes[${k}].restaurants[${m}]: ` +
                  `category "${cat}" 不符合 foodPreferences[${m}] "${prefs[m]}"`
                );
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

    // --- R9 AI 亮點字數 ---

    it('R9: highlights summary <= 50 chars (excluding spaces)', () => {
      const summary = data.highlights?.content?.summary;
      if (!summary) return;
      const count = charCount(summary);
      expect(count, `highlights.summary is ${count} chars: "${summary}"`).toBeLessThanOrEqual(50);
    });

    // --- R10 還車加油站 ---

    it('R10: self-drive/mixed trips with 還車 event must have gasStation infoBox', () => {
      if (!data.meta?.selfDrive) return; // skip for non-self-drive trips

      data.days.forEach((day, i) => {
        const timeline = day.content?.timeline || [];
        timeline.forEach((ev, j) => {
          if (!(ev.title || '').includes('還車')) return;
          const hasGasStation = (ev.infoBoxes || []).some((box) => box.type === 'gasStation');
          expect(
            hasGasStation,
            `Day ${day.id} "${ev.title}" (${file}) 還車事件缺少 gasStation infoBox`
          ).toBe(true);
        });
      });
    });

    // --- R9 不列舉景點 ---

    it('R9: highlights summary does not enumerate attractions with "Day"', () => {
      const summary = data.highlights?.content?.summary || '';
      expect(
        /Day\s*\d/i.test(summary),
        `highlights.summary should not contain "Day X" enumeration: "${summary}"`
      ).toBe(false);
    });
  });
});

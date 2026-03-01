/**
 * 整合測試：用真實 JSON 資料驗證完整渲染管線
 * 確保 JSON 結構 → render 函式 → HTML 輸出的端對端正確性
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const { escHtml } = require('../../shared.js');
const {
  renderDayContent,
  renderFlights,
  renderChecklist,
  renderBackup,
  renderEmergency,
  renderSuggestions,
  renderTimeline,
  renderHotel,
  renderBudget,
  renderTimelineEvent,
  renderRestaurant,
  renderInfoBox,
  renderWarnings,
  validateDay,
} = require('../../app.js');

const DATA_DIR = resolve(__dirname, '../../data/trips');

const tripFiles = [
  { file: 'okinawa-trip-2026-Ray.json', label: 'Ray' },
  { file: 'okinawa-trip-2026-HuiYun.json', label: 'HuiYun' },
];

tripFiles.forEach(({ file, label }) => {
  describe(`整合測試：${label} 行程完整渲染`, () => {
    let data;

    beforeAll(() => {
      data = JSON.parse(readFileSync(resolve(DATA_DIR, file), 'utf8'));
    });

    /* ===== 每日內容渲染 ===== */
    describe('每日內容 (renderDayContent)', () => {
      it('每一天都能成功渲染，不拋出錯誤', () => {
        data.days.forEach((day) => {
          expect(() => renderDayContent(day.content || {}, null)).not.toThrow();
        });
      });

      it('每一天渲染結果為非空 HTML', () => {
        data.days.forEach((day) => {
          const html = renderDayContent(day.content || {}, null);
          expect(html.length, `Day ${day.id} 渲染結果不應為空`).toBeGreaterThan(0);
        });
      });

      it('有 hotel 的天數渲染包含飯店資訊', () => {
        data.days.forEach((day) => {
          if (day.content && day.content.hotel) {
            const html = renderDayContent(day.content, null);
            expect(html).toContain('🏨');
            expect(html).toContain('col-row');
          }
        });
      });

      it('有 budget 的天數渲染包含預算表格', () => {
        data.days.forEach((day) => {
          if (day.content && day.content.budget) {
            const html = renderDayContent(day.content, null);
            expect(html).toContain('💰');
            expect(html).toContain('col-row');
          }
        });
      });

      it('有 timeline 的天數渲染包含時間軸', () => {
        data.days.forEach((day) => {
          if (day.content && day.content.timeline && day.content.timeline.length) {
            const html = renderDayContent(day.content, null);
            expect(html).toContain('timeline');
            expect(html).toContain('tl-event');
          }
        });
      });

      it('帶 weatherId 時渲染天氣容器', () => {
        const day = data.days[0];
        const weatherId = data.weather[0] ? data.weather[0].id : null;
        if (weatherId) {
          const html = renderDayContent(day.content || {}, weatherId);
          expect(html).toContain('hourly-weather');
          expect(html).toContain(weatherId);
        }
      });
    });

    /* ===== Timeline 事件逐一渲染 ===== */
    describe('Timeline 事件逐一渲染', () => {
      it('所有天的所有 timeline 事件都能成功渲染', () => {
        data.days.forEach((day) => {
          if (!day.content || !day.content.timeline) return;
          day.content.timeline.forEach((ev) => {
            expect(() => renderTimelineEvent(ev)).not.toThrow();
            const html = renderTimelineEvent(ev);
            expect(html).toContain('tl-event');
            if (ev.time) expect(html).toContain('tl-time');
            if (ev.title) expect(html).toContain('tl-title');
          });
        });
      });

      it('有 infoBoxes 的事件渲染出 tl-body', () => {
        data.days.forEach((day) => {
          if (!day.content || !day.content.timeline) return;
          day.content.timeline.forEach((ev) => {
            if (ev.infoBoxes && ev.infoBoxes.length) {
              const html = renderTimelineEvent(ev);
              expect(html).toContain('tl-body');
              expect(html).toContain('clickable');
            }
          });
        });
      });

      it('有 transit 的事件渲染出 transit 區塊', () => {
        let found = false;
        data.days.forEach((day) => {
          if (!day.content || !day.content.timeline) return;
          day.content.timeline.forEach((ev) => {
            if (ev.transit) {
              found = true;
              const html = renderTimelineEvent(ev);
              expect(html).toContain('tl-transit');
            }
          });
        });
        // 至少找到一個 transit 事件
        expect(found, '應至少有一個 transit 事件').toBe(true);
      });
    });

    /* ===== InfoBox 逐一渲染 ===== */
    describe('InfoBox 逐一渲染', () => {
      it('所有 infoBox 都能成功渲染', () => {
        data.days.forEach((day) => {
          if (!day.content || !day.content.timeline) return;
          day.content.timeline.forEach((ev) => {
            if (!ev.infoBoxes) return;
            ev.infoBoxes.forEach((box) => {
              expect(() => renderInfoBox(box)).not.toThrow();
              const html = renderInfoBox(box);
              expect(html).toContain('info-box');
            });
          });
        });
      });

      it('restaurants 類型的 infoBox 內含餐廳卡片', () => {
        let found = false;
        data.days.forEach((day) => {
          if (!day.content || !day.content.timeline) return;
          day.content.timeline.forEach((ev) => {
            if (!ev.infoBoxes) return;
            ev.infoBoxes.forEach((box) => {
              if (box.type === 'restaurants' && box.restaurants) {
                found = true;
                const html = renderInfoBox(box);
                expect(html).toContain('restaurant-choice');
                box.restaurants.forEach((r) => {
                  expect(html).toContain(escHtml(r.name));
                });
              }
            });
          });
        });
        expect(found, '應至少有一個 restaurants infoBox').toBe(true);
      });
    });

    /* ===== 餐廳逐一渲染 ===== */
    describe('餐廳逐一渲染', () => {
      it('所有餐廳都能渲染且包含名稱', () => {
        data.days.forEach((day) => {
          if (!day.content || !day.content.timeline) return;
          day.content.timeline.forEach((ev) => {
            if (!ev.infoBoxes) return;
            ev.infoBoxes.forEach((box) => {
              if (box.type !== 'restaurants' || !box.restaurants) return;
              box.restaurants.forEach((r) => {
                const html = renderRestaurant(r);
                expect(html).toContain('restaurant-choice');
                expect(html).toContain(escHtml(r.name));
                if (r.hours) expect(html).toContain(escHtml(r.hours));
              });
            });
          });
        });
      });
    });

    /* ===== 飯店渲染 ===== */
    describe('飯店渲染', () => {
      it('所有飯店資料都能成功渲染', () => {
        data.days.forEach((day) => {
          if (!day.content || !day.content.hotel) return;
          const html = renderHotel(day.content.hotel);
          expect(html).toContain('🏨');
          expect(html).toContain(escHtml(day.content.hotel.name));
        });
      });
    });

    /* ===== 預算渲染 ===== */
    describe('預算渲染', () => {
      it('所有預算資料都能成功渲染', () => {
        data.days.forEach((day) => {
          if (!day.content || !day.content.budget) return;
          const html = renderBudget(day.content.budget);
          expect(html).toContain('💰');
          if (day.content.budget.items && day.content.budget.items.length) {
            expect(html).toContain('budget-table');
          }
        });
      });
    });

    /* ===== 資訊區段渲染 ===== */
    describe('航班資訊 (renderFlights)', () => {
      it('渲染不拋出錯誤且包含航班資料', () => {
        if (!data.flights || !data.flights.content) return;
        const html = renderFlights(data.flights.content);
        expect(html.length).toBeGreaterThan(0);
        expect(html).toContain('flight-row');
        if (data.flights.content.segments) {
          data.flights.content.segments.forEach((seg) => {
            if (seg.label) expect(html).toContain(escHtml(seg.label));
          });
        }
      });
    });

    describe('出發前確認 (renderChecklist)', () => {
      it('渲染不拋出錯誤且包含卡片', () => {
        if (!data.checklist || !data.checklist.content) return;
        const html = renderChecklist(data.checklist.content);
        expect(html.length).toBeGreaterThan(0);
        expect(html).toContain('ov-grid');
        expect(html).toContain('ov-card');
      });
    });

    describe('雨天備案 (renderBackup)', () => {
      it('渲染不拋出錯誤且包含備案內容', () => {
        if (!data.backup || !data.backup.content) return;
        const html = renderBackup(data.backup.content);
        expect(html.length).toBeGreaterThan(0);
        expect(html).toContain('ov-grid');
      });

      it('weatherItems 有渲染為列表', () => {
        if (!data.backup || !data.backup.content || !data.backup.content.cards) return;
        const cardsWithWeather = data.backup.content.cards.filter((c) => c.weatherItems && c.weatherItems.length);
        if (cardsWithWeather.length) {
          const html = renderBackup(data.backup.content);
          expect(html).toContain('weather-list');
        }
      });
    });

    describe('緊急聯絡 (renderEmergency)', () => {
      it('渲染不拋出錯誤且包含聯絡資訊', () => {
        if (!data.emergency || !data.emergency.content) return;
        const html = renderEmergency(data.emergency.content);
        expect(html.length).toBeGreaterThan(0);
        expect(html).toContain('ov-card');
      });

      it('電話號碼渲染為 tel: 連結', () => {
        if (!data.emergency || !data.emergency.content) return;
        const html = renderEmergency(data.emergency.content);
        expect(html).toContain('tel:');
      });
    });

    describe('行程建議 (renderSuggestions)', () => {
      it('渲染不拋出錯誤且包含建議卡片', () => {
        if (!data.suggestions || !data.suggestions.content) return;
        const html = renderSuggestions(data.suggestions.content);
        expect(html.length).toBeGreaterThan(0);
        expect(html).toContain('suggestion-card');
      });

      it('包含高/中/低優先級', () => {
        if (!data.suggestions || !data.suggestions.content) return;
        const html = renderSuggestions(data.suggestions.content);
        expect(html).toContain('suggestion-card high');
        expect(html).toContain('suggestion-card medium');
        expect(html).toContain('suggestion-card low');
      });
    });

    /* ===== validateDay 跑真實資料 ===== */
    describe('validateDay 真實資料', () => {
      it('所有天的驗證都不拋出錯誤', () => {
        data.days.forEach((day) => {
          expect(() => validateDay(day)).not.toThrow();
        });
      });

      it('驗證結果為陣列', () => {
        data.days.forEach((day) => {
          const warnings = validateDay(day);
          expect(Array.isArray(warnings)).toBe(true);
        });
      });

      it('警告可正確渲染', () => {
        data.days.forEach((day) => {
          const warnings = validateDay(day);
          if (warnings.length) {
            const html = renderWarnings(warnings);
            expect(html).toContain('trip-warnings');
            expect(html).toContain('⚠️');
          }
        });
      });
    });

    /* ===== XSS 防護整合驗證 ===== */
    describe('XSS 防護整合驗證', () => {
      it('渲染結果不包含未跳脫的 <script> 標籤', () => {
        const allHtml = data.days.map((day) => renderDayContent(day.content || {}, null)).join('');
        expect(allHtml).not.toMatch(/<script[\s>]/i);
      });

      it('渲染結果不包含 javascript: URL', () => {
        const sections = [
          ...data.days.map((day) => renderDayContent(day.content || {}, null)),
        ];
        if (data.flights) sections.push(renderFlights(data.flights.content || {}));
        if (data.checklist) sections.push(renderChecklist(data.checklist.content || {}));
        if (data.backup) sections.push(renderBackup(data.backup.content || {}));
        if (data.emergency) sections.push(renderEmergency(data.emergency.content || {}));
        if (data.suggestions) sections.push(renderSuggestions(data.suggestions.content || {}));

        const allHtml = sections.join('');
        expect(allHtml).not.toContain('javascript:');
      });

      it('所有 <a> 標籤都有 rel="noopener noreferrer"', () => {
        const allHtml = data.days.map((day) => renderDayContent(day.content || {}, null)).join('');
        const anchors = allHtml.match(/<a [^>]*target="_blank"[^>]*>/g) || [];
        anchors.forEach((anchor) => {
          expect(anchor).toContain('rel="noopener noreferrer"');
        });
      });
    });
  });
});

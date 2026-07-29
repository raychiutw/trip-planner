/**
 * 天氣改用氣象廳（JMA）模型 + 降雨改毫米。
 *
 * 2026-07-29 owner 人在沖繩回報「天氣預報與我查的資料差異很大」。實測同一座標
 * （那霸 26.2124,127.6809）同一天：
 *
 *   Open-Meteo 預設   07-29  25.5–31.7°C  降雨76%  code=96（雷雨帶冰雹）
 *   JMA (jma_seamless) 07-29  27.6–30.9°C  —        code=55（毛毛雨）
 *   ...連四天預設都報雷雨 95/96，JMA 說毛毛雨轉晴（code 1）
 *
 * 日本的天氣網站（tenki.jp / Yahoo天気 / ウェザーニュース）用的是氣象廳資料，
 * 所以 App 跟使用者手邊查到的永遠對不上。
 *
 * ⚠️ JMA 模型**不提供 precipitation_probability**（小時與日級都回 null），
 * 只提供 precipitation（mm）。owner 選擇全套 JMA + 降雨顯示毫米，換取單一模型
 * 的一致性（混兩個模型會出現「毛毛雨 · 降雨 76%」這種不協調組合）。
 *
 * ⚠️ 已知取捨：jma_seamless 出了日本會退到 JMA 的全球模式 GSM（實測首爾、台北
 * 都回得出資料），不見得優於 Open-Meteo 的 best_match 混合。台灣/韓國行程接受
 * 這個代價換一致性 —— 這個 repo 的 POI 是 JP 359 : TW 10。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const SRC = readFileSync('src/lib/weather.ts', 'utf-8');
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const UI = readFileSync('src/components/trip/HourlyWeather.tsx', 'utf-8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

describe('天氣改用 JMA 模型', () => {
  it('請求帶 models=jma_seamless', () => {
    expect(CODE).toContain('jma_seamless');
  });

  it('hourly 要 precipitation（mm）而不是 precipitation_probability', () => {
    const m = CODE.match(/hourly:\s*'([^']+)'/);
    expect(m, "找不到 hourly 參數").not.toBeNull();
    const fields = m![1].split(',');
    expect(fields).toContain('precipitation');
    expect(fields).not.toContain('precipitation_probability');
  });

  it('不再讀 precipitation_probability（JMA 一律回 null，讀了就是全 0）', () => {
    expect(CODE).not.toContain('precipitation_probability');
  });

  it('UI 顯示單位改成 mm，不再是 %', () => {
    expect(UI).toContain('mm');
    expect(UI).not.toMatch(/\{rain\}%/);
    expect(UI).not.toMatch(/\{maxR\}%/);
  });
});

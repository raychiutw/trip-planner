/**
 * reservationJsonToText — trip_entry_pois.reservation 欄位語意漂移修復（共用 helper）。
 *
 * 背景：reservation 型別是 string（設計上文字註解），但 AI 生成路徑誤把結構化訂位狀態
 * 寫成 JSON（{"available","method","url"/"phone","recommended"}）塞進此欄，prod 43 筆污染、
 * 前端直接印 → 露出 raw {...}。此 helper 把 JSON-shaped reservation 轉成人話文字：
 *   - 清理 script（A）：轉文字 append 進 note 備註、reservation 清空。
 *   - 寫入防堵（D）：API 寫入偵測 JSON → 轉文字放回 reservation，防再污染。
 */
import { describe, it, expect } from 'vitest';
import { reservationJsonToText, isJsonShapedReservation, normalizeReservation } from '../../functions/api/_reservation';

describe('reservationJsonToText', () => {
  it('available:no → 「不需訂位」', () => {
    expect(reservationJsonToText('{"available":"no","recommended":false}')).toBe('不需訂位');
  });

  it('yes + website + url + recommended → 「建議網路預約：<url>」', () => {
    expect(
      reservationJsonToText('{"available":"yes","method":"website","url":"https://www.tablecheck.com/en/shops/ufuya/reserve","recommended":true}'),
    ).toBe('建議網路預約：https://www.tablecheck.com/en/shops/ufuya/reserve');
  });

  it('yes + website + recommended（無 url）→ 「建議網路預約」', () => {
    expect(reservationJsonToText('{"available":"yes","method":"website","recommended":true}')).toBe('建議網路預約');
  });

  it('yes + phone + phone + recommended → 「建議電話預約：<phone>」', () => {
    expect(
      reservationJsonToText('{"available":"yes","method":"phone","phone":"098-966-2180","recommended":true}'),
    ).toBe('建議電話預約：098-966-2180');
  });

  it('yes + phone + recommended（無 phone）→ 「建議電話預約」', () => {
    expect(reservationJsonToText('{"available":"yes","method":"phone","recommended":true}')).toBe('建議電話預約');
  });

  it('純文字（非 JSON）→ null（不轉）', () => {
    expect(reservationJsonToText('官網預約')).toBeNull();
    expect(reservationJsonToText('不需訂位')).toBeNull();
    expect(reservationJsonToText('EPARK 預約')).toBeNull();
  });

  it('空 / null / undefined / 壞 JSON → null', () => {
    expect(reservationJsonToText('')).toBeNull();
    expect(reservationJsonToText(null)).toBeNull();
    expect(reservationJsonToText(undefined)).toBeNull();
    expect(reservationJsonToText('{壞 json')).toBeNull();
    expect(reservationJsonToText('[1,2,3]')).toBeNull(); // array 非 object → null
  });

  it('isJsonShapedReservation：JSON-shaped 才 true', () => {
    expect(isJsonShapedReservation('{"available":"no","recommended":false}')).toBe(true);
    expect(isJsonShapedReservation('官網預約')).toBe(false);
    expect(isJsonShapedReservation('')).toBe(false);
    expect(isJsonShapedReservation(null)).toBe(false);
    expect(isJsonShapedReservation('{壞')).toBe(false); // 開頭像 JSON 但 parse 失敗 → false
  });

  it('normalizeReservation（寫入防堵）：JSON→文字、純文字原樣、null→null', () => {
    expect(normalizeReservation('{"available":"yes","method":"phone","phone":"098-1","recommended":true}')).toBe('建議電話預約：098-1');
    expect(normalizeReservation('官網預約')).toBe('官網預約'); // 純文字保持原樣
    expect(normalizeReservation('{壞 json')).toBe('{壞 json'); // 壞 JSON 非 shaped → 原樣（不丟資料）
    expect(normalizeReservation(null)).toBeNull();
    expect(normalizeReservation(undefined)).toBeNull();
  });
});

import { describe, it, expect } from 'vitest';
import {
  YUI_STATIONS,
  nearestYuiStation,
  railMinutes,
  railMeters,
  computeYuiTravel,
} from '../../src/lib/yuiRail';

// 站座標（HeartRails）作為測試 fixture。
const NAHA_AIRPORT = { lat: 26.206515, lng: 127.652214 }; // 那覇空港 cumKm=0
const KENCHOMAE = { lat: 26.214446, lng: 127.679343 };     // 県庁前 cumKm=6.0
const TEDAKO = { lat: 26.241759, lng: 127.741959 };        // てだこ浦西 cumKm=17.0
const TOKYO = { lat: 35.681236, lng: 139.767125 };          // 東京駅（遠離所有 Yui 站）

describe('yuiRail — 靜態表', () => {
  it('19 站、順序 那覇空港(0) → てだこ浦西(17.0)、cumKm 遞增', () => {
    expect(YUI_STATIONS).toHaveLength(19);
    expect(YUI_STATIONS[0].name).toBe('那覇空港');
    expect(YUI_STATIONS[0].cumKm).toBe(0);
    expect(YUI_STATIONS[18].name).toBe('てだこ浦西');
    expect(YUI_STATIONS[18].cumKm).toBe(17.0);
    for (let i = 1; i < YUI_STATIONS.length; i++) {
      expect(YUI_STATIONS[i].cumKm).toBeGreaterThan(YUI_STATIONS[i - 1].cumKm);
    }
  });
});

describe('nearestYuiStation', () => {
  it('站點座標 → 該站本身、距離 ~0', () => {
    const r = nearestYuiStation(KENCHOMAE);
    expect(r.station.name).toBe('県庁前');
    expect(r.distanceM).toBeLessThan(20);
  });
  it('遠離所有站（東京）→ 仍回最近站但距離極大', () => {
    const r = nearestYuiStation(TOKYO);
    expect(r.distanceM).toBeGreaterThan(1_000_000);
  });
});

describe('railMinutes / railMeters', () => {
  it('端到端 那覇空港↔てだこ浦西 = 37 分（官方）', () => {
    expect(railMinutes(YUI_STATIONS[0], YUI_STATIONS[18])).toBe(37);
  });
  it('那覇空港→県庁前 = 13 分（6.0km 等比）、方向無關', () => {
    expect(railMinutes(YUI_STATIONS[0], YUI_STATIONS[6])).toBe(13);
    expect(railMinutes(YUI_STATIONS[6], YUI_STATIONS[0])).toBe(13);
  });
  it('同站 = 0 分', () => {
    expect(railMinutes(YUI_STATIONS[6], YUI_STATIONS[6])).toBe(0);
  });
  it('railMeters = cumKm 差 × 1000', () => {
    expect(railMeters(YUI_STATIONS[0], YUI_STATIONS[6])).toBe(6000);
  });
});

describe('computeYuiTravel', () => {
  it('兩站之間 → ok，min = 走路+單軌+走路、distanceM 含 rail', () => {
    const r = computeYuiTravel(NAHA_AIRPORT, KENCHOMAE);
    expect(r.ok).toBe(true);
    if (r.ok) {
      // 走路各 ~1 分（站點座標，min 1）+ rail 13 = 15
      expect(r.min).toBe(15);
      expect(r.distanceM).toBe(6000);
    }
  });

  it('端到端 那覇空港→てだこ浦西 → rail 37 + 走路', () => {
    const r = computeYuiTravel(NAHA_AIRPORT, TEDAKO);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.min).toBe(39); // 1 + 37 + 1
  });

  it('一端遠離所有站 → too_far', () => {
    const r = computeYuiTravel(TOKYO, KENCHOMAE);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('too_far');
  });

  it('兩端最近站相同 → same_station（建議走路）', () => {
    const r = computeYuiTravel(NAHA_AIRPORT, { lat: 26.2066, lng: 127.6523 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('same_station');
  });
});

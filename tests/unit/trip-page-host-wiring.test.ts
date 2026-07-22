/**
 * main.tsx — TripPageHost 掛在 <Routes> 之上（owner 2026-07-21 回報 #2 修復）。
 * Pure source-grep（main.tsx 是 app 進入點，full mount 需要整個 route tree +
 * 一堆 provider，屬於 e2e scope；wiring 本身用 source-grep 鎖住不漂移）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const MAIN = readFileSync(join(__dirname, '../../src/entries/main.tsx'), 'utf8');

describe('main.tsx — TripPageHost wiring', () => {
  it('import TripPageHost', () => {
    expect(MAIN).toMatch(/import TripPageHost from ['"]\.\.\/components\/trip\/TripPageHost['"]/);
  });

  it('TripPageHost 包住 <Routes>（必須是 Routes 的祖先，不能是 Routes 的子路由，否則路由切換一樣會把它 unmount 掉）', () => {
    const openIdx = MAIN.indexOf('<TripPageHost>');
    const routesOpenIdx = MAIN.indexOf('<Routes>');
    const routesCloseIdx = MAIN.indexOf('</Routes>');
    const closeIdx = MAIN.indexOf('</TripPageHost>');
    expect(openIdx).toBeGreaterThan(-1);
    expect(routesOpenIdx).toBeGreaterThan(openIdx);
    expect(routesCloseIdx).toBeGreaterThan(routesOpenIdx);
    expect(closeIdx).toBeGreaterThan(routesCloseIdx);
  });
});

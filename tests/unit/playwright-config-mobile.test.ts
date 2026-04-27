/**
 * playwright.config.js — mobile devices projects 驗證（B-P6 task 7.1）
 *
 * 確保 mobile-chrome (Pixel 5) + mobile-safari (iPhone 13) projects 存在，
 * 防止未來 refactor 把 mobile matrix 意外移除。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const CONFIG_SRC = fs.readFileSync(
  path.resolve(__dirname, '../../playwright.config.js'),
  'utf8',
);

describe('playwright.config.js — mobile device matrix', () => {
  it('import devices 從 @playwright/test', () => {
    expect(CONFIG_SRC).toMatch(/import\s*\{[^}]*devices[^}]*\}\s*from\s*['"]@playwright\/test['"]/);
  });

  it('projects 含 chromium', () => {
    expect(CONFIG_SRC).toMatch(/name:\s*['"]chromium['"]/);
  });

  it('預設 block service workers，避免 PWA cache 繞過 Playwright API mocks', () => {
    expect(CONFIG_SRC).toMatch(/serviceWorkers:\s*['"]block['"]/);
  });

  it('projects 含 mobile-chrome（Pixel 5）— task 7.1', () => {
    expect(CONFIG_SRC).toMatch(/name:\s*['"]mobile-chrome['"]/);
    expect(CONFIG_SRC).toMatch(/devices\[['"]Pixel\s*5['"]\]/);
    expect(CONFIG_SRC).toMatch(/name:\s*['"]mobile-chrome['"][\s\S]*browserName:\s*['"]chromium['"]/);
  });

  it('projects 含 mobile-safari（iPhone 13）— task 7.1', () => {
    expect(CONFIG_SRC).toMatch(/name:\s*['"]mobile-safari['"]/);
    expect(CONFIG_SRC).toMatch(/devices\[['"]iPhone\s*13['"]\]/);
    expect(CONFIG_SRC).toMatch(/name:\s*['"]mobile-safari['"][\s\S]*browserName:\s*['"]webkit['"]/);
  });
});

/**
 * 登入頁左上角的 Tripline 連結（owner 2026-07-21）
 *
 * `/login` 先前沒有任何回首頁的出口 —— 未登入訪客從 Google 搜尋或分享連結
 * 落到登入頁，就只能登入或關掉，看不到 app 在做什麼。v2.57.0 才剛加了未登入
 * 首頁 `/`，登入頁卻連不過去。
 *
 * 用 `<a href="/">` 而非 `navigate('/')`：這是回站台根目錄的品牌連結，
 * 中鍵／右鍵「開新分頁」該要能用，那是 anchor 的預設行為。
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../../src/pages/LoginPage';

function renderLogin() {
  return render(<MemoryRouter initialEntries={['/login']}><LoginPage /></MemoryRouter>);
}

describe('LoginPage — 左上角回首頁', () => {
  it('有一個連到 / 的 Tripline 連結', () => {
    renderLogin();
    const link = screen.getByTestId('login-home-link');
    expect(link.tagName, '要用 anchor，開新分頁才會正常').toBe('A');
    expect(link.getAttribute('href')).toBe('/');
    expect(link.textContent).toMatch(/Tripline/);
  });

  it('是可讀的連結名稱（螢幕閱讀器聽得懂要去哪）', () => {
    renderLogin();
    const link = screen.getByTestId('login-home-link');
    const label = link.getAttribute('aria-label') ?? link.textContent ?? '';
    expect(label).toMatch(/首頁|Tripline/);
  });

  it('觸控區至少 44px（HIG 最小觸控目標）', () => {
    renderLogin();
    const styles = document.querySelector('style')?.textContent ?? '';
    const rule = styles.slice(styles.indexOf('.tp-login-home'));
    expect(rule, '缺少 min-height').toMatch(/min-height:\s*44px/);
  });
});

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import AppearanceSettingsPage from '../../src/pages/AppearanceSettingsPage';
import { useDarkMode } from '../../src/hooks/useDarkMode';
import { usePrintMode } from '../../src/hooks/usePrintMode';
let dark: boolean; const listeners = new Set<(event: MediaQueryListEvent) => void>();
beforeEach(() => {
  dark = false; listeners.clear(); localStorage.clear(); document.body.classList.remove('dark');
  window.scrollTo = vi.fn();
  if (!document.querySelector('meta[name="theme-color"]')) { const meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta); }
  vi.stubGlobal('matchMedia', (query: string) => ({ get matches() { return query === '(prefers-color-scheme: dark)' && dark; }, media: query, addEventListener: (name: string, fn: (event: MediaQueryListEvent) => void) => { if (query === '(prefers-color-scheme: dark)') listeners.add(fn); }, removeEventListener: (name: string, fn: (event: MediaQueryListEvent) => void) => listeners.delete(fn) }));
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => new Response(JSON.stringify(String(input).includes('/oauth/userinfo') ? { id: 'reader', email: 'reader@example.com', displayName: 'Reader' } : []))));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); document.body.classList.remove('dark'); });
function Observer() { const { isDark, colorMode } = useDarkMode(); return <output data-testid="theme-observer">{colorMode}:{isDark ? 'dark' : 'light'}</output>; }
function open() { return render(<StrictMode><MemoryRouter><Observer /><AppearanceSettingsPage /></MemoryRouter></StrictMode>); }
function system(value: boolean) { act(() => { dark = value; for (const listener of listeners) listener({ matches: value } as MediaQueryListEvent); }); }
it('shares the manual choice with existing consumers and ignores subsequent system changes', async () => {
  open(); const button = await screen.findByTestId('appearance-theme-dark'); button.focus(); fireEvent.click(button);
  expect(screen.getByTestId('theme-observer')).toHaveTextContent('dark:dark'); expect(button).toHaveFocus();
  expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#1C1C1E');
  system(true); system(false);
  expect(document.body).toHaveClass('dark'); expect(button).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByTestId('appearance-theme-auto')); expect(document.body).not.toHaveClass('dark');
  expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#A97A4A');
  system(true); expect(document.body).toHaveClass('dark'); expect(screen.getByTestId('theme-observer')).toHaveTextContent('auto:dark');
});
it('reloads the saved selection and applies changes from another tab', async () => {
  const view = open(); fireEvent.click(await screen.findByTestId('appearance-theme-dark')); view.unmount();
  open(); expect(screen.getByTestId('appearance-theme-dark')).toHaveAttribute('aria-pressed', 'true');
  act(() => { localStorage.setItem('tp-color-mode', JSON.stringify({ v: 'light', exp: Date.now() + 60000 })); window.dispatchEvent(new StorageEvent('storage', { key: 'tp-color-mode' })); });
  expect(screen.getByTestId('theme-observer')).toHaveTextContent('light:light');
  expect(screen.getByTestId('appearance-theme-light')).toHaveAttribute('aria-pressed', 'true');
});
it('reports failed persistence while keeping the chosen appearance for the current visit', async () => {
  open(); const button = await screen.findByTestId('appearance-theme-dark');
  vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  fireEvent.click(button); expect(document.body).toHaveClass('dark');
  expect(await screen.findByRole('alert')).toHaveTextContent('無法儲存');
  vi.restoreAllMocks(); fireEvent.click(button); expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

function Printer() { const { setPrintAppearance } = useDarkMode(); const { togglePrint } = usePrintMode({ setPrintAppearance }); return <button onClick={togglePrint}>列印預覽</button>; }
it('print appearance never overwrites the preference and restores the latest system choice, including on leaving', () => {
  dark = true; const view = render(<StrictMode><Observer /><Printer /></StrictMode>);
  expect(document.body).toHaveClass('dark');
  fireEvent.click(screen.getByRole('button', { name: '列印預覽' })); expect(document.body).not.toHaveClass('dark');
  fireEvent.click(screen.getByRole('button', { name: '列印預覽' })); expect(document.body).toHaveClass('dark');
  act(() => window.dispatchEvent(new Event('beforeprint')));
  expect(document.body).not.toHaveClass('dark'); expect(document.body).toHaveClass('print-mode');
  expect(screen.getByTestId('theme-observer')).toHaveTextContent('auto:light');
  system(false); act(() => window.dispatchEvent(new Event('afterprint')));
  expect(document.body).not.toHaveClass('dark'); expect(document.body).not.toHaveClass('print-mode');
  system(true); expect(document.body).toHaveClass('dark');
  fireEvent.click(screen.getByRole('button', { name: '列印預覽' })); expect(document.body).not.toHaveClass('dark');
  fireEvent.click(screen.getByRole('button', { name: '列印預覽' })); expect(document.body).toHaveClass('dark');
  act(() => window.dispatchEvent(new Event('beforeprint'))); view.unmount();
  expect(document.body).not.toHaveClass('print-mode'); expect(document.body).not.toHaveClass('theme-print');
  expect(document.body).toHaveClass('dark'); expect(localStorage.getItem('tp-color-mode')).toBeNull();
});

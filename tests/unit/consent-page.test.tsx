/**
 * ConsentPage unit test — V2-P5 starter
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ConsentPage from '../../src/pages/ConsentPage';

beforeEach(() => {
  // Mock window.location.href setter (for redirect)
  Object.defineProperty(window, 'location', {
    value: { ...window.location, href: 'about:blank' },
    writable: true,
  });
});

function renderWithParams(query: string) {
  return render(
    <MemoryRouter initialEntries={[`/oauth/consent?${query}`]}>
      <ConsentPage />
    </MemoryRouter>,
  );
}

describe('ConsentPage', () => {
  it('renders error when client_id missing', async () => {
    renderWithParams('scope=openid');
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByRole('alert').textContent).toContain('Missing client_id');
  });

  it('renders client app name + requested scopes', async () => {
    renderWithParams('client_id=partner-x&scope=openid+profile+email&redirect_uri=https://x.com/cb&state=s');
    await waitFor(() => expect(screen.getByTestId('consent-scopes')).toBeTruthy());
    expect(screen.getByText(/partner-x/)).toBeTruthy();
    expect(screen.getByTestId('consent-scope-openid')).toBeTruthy();
    expect(screen.getByTestId('consent-scope-profile')).toBeTruthy();
    expect(screen.getByTestId('consent-scope-email')).toBeTruthy();
  });

  it('shows scope description in zh-tw', async () => {
    renderWithParams('client_id=p&scope=email&redirect_uri=&state=');
    await waitFor(() => expect(screen.getByTestId('consent-scope-email')).toBeTruthy());
    expect(screen.getByTestId('consent-scope-email').textContent).toContain('email 地址');
  });

  it('Allow button → window.location.href = server-authorize URL with consent_granted', async () => {
    renderWithParams('client_id=p&scope=openid&redirect_uri=https://x.com/cb&state=s');
    await waitFor(() => screen.getByTestId('consent-allow'));
    fireEvent.click(screen.getByTestId('consent-allow'));
    expect(window.location.href).toContain('/api/oauth/authorize?');
    expect(window.location.href).toContain('client_id=p');
    expect(window.location.href).toContain('consent_granted=1');
  });

  it('Deny button → redirect_uri?error=access_denied&state=', async () => {
    renderWithParams('client_id=p&scope=openid&redirect_uri=https%3A%2F%2Fx.com%2Fcb&state=csrf-tok');
    await waitFor(() => screen.getByTestId('consent-deny'));
    fireEvent.click(screen.getByTestId('consent-deny'));
    expect(window.location.href).toContain('https://x.com/cb');
    expect(window.location.href).toContain('error=access_denied');
    expect(window.location.href).toContain('state=csrf-tok');
  });

  it('Deny without redirect_uri → no redirect (early return)', async () => {
    Object.defineProperty(window, 'location', { value: { href: 'initial' }, writable: true });
    renderWithParams('client_id=p&scope=openid');
    await waitFor(() => screen.getByTestId('consent-deny'));
    fireEvent.click(screen.getByTestId('consent-deny'));
    expect(window.location.href).toBe('initial');
  });

  it('Empty scope shows "無 scope 請求"', async () => {
    renderWithParams('client_id=p&scope=&redirect_uri=https://x.com&state=');
    await waitFor(() => screen.getByTestId('consent-scopes'));
    expect(screen.getByTestId('consent-scopes').textContent).toContain('無 scope 請求');
  });
});

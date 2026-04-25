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

  it('Allow button submits POST form to /api/oauth/consent with decision=allow', async () => {
    renderWithParams('client_id=p&scope=openid&redirect_uri=https://x.com/cb&state=s');
    await waitFor(() => screen.getByTestId('consent-allow'));
    const allowBtn = screen.getByTestId('consent-allow') as HTMLButtonElement;
    const form = allowBtn.closest('form') as HTMLFormElement;
    expect(form).toBeTruthy();
    expect(form.method.toLowerCase()).toBe('post');
    expect(form.action).toContain('/api/oauth/consent');
    const decision = form.querySelector('input[name="decision"]') as HTMLInputElement;
    expect(decision.value).toBe('allow');
    const cid = form.querySelector('input[name="client_id"]') as HTMLInputElement;
    expect(cid.value).toBe('p');
    const ruri = form.querySelector('input[name="redirect_uri"]') as HTMLInputElement;
    expect(ruri.value).toBe('https://x.com/cb');
    const st = form.querySelector('input[name="state"]') as HTMLInputElement;
    expect(st.value).toBe('s');
  });

  it('Deny button submits POST form to /api/oauth/consent with decision=deny (no client-side redirect)', async () => {
    renderWithParams('client_id=p&scope=openid&redirect_uri=https%3A%2F%2Fx.com%2Fcb&state=csrf-tok');
    await waitFor(() => screen.getByTestId('consent-deny'));
    const denyBtn = screen.getByTestId('consent-deny') as HTMLButtonElement;
    const form = denyBtn.closest('form') as HTMLFormElement;
    expect(form).toBeTruthy();
    expect(form.method.toLowerCase()).toBe('post');
    expect(form.action).toContain('/api/oauth/consent');
    const decision = form.querySelector('input[name="decision"]') as HTMLInputElement;
    expect(decision.value).toBe('deny');
    // redirect_uri is in the form body — server validates against client_apps allowlist
    const ruri = form.querySelector('input[name="redirect_uri"]') as HTMLInputElement;
    expect(ruri.value).toBe('https://x.com/cb');
  });

  it('Empty scope shows "無 scope 請求"', async () => {
    renderWithParams('client_id=p&scope=&redirect_uri=https://x.com&state=');
    await waitFor(() => screen.getByTestId('consent-scopes'));
    expect(screen.getByTestId('consent-scopes').textContent).toContain('無 scope 請求');
  });
});

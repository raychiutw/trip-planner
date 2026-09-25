import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useAiDataConsentAction } from '../../src/hooks/useAiDataConsentAction';
import { ApiError } from '../../src/lib/errors';

const fetchConsent = vi.fn();
vi.mock('../../src/lib/apiClient', () => ({ apiFetch: (...args: unknown[]) => fetchConsent(...args) }));

const disclosure = { version: 'test-v1', title: '測試說明', processor: '測試方', dataCategories: ['行程'], purpose: '測試', revocation: '聊天頁' };
const notAccepted = { disclosure, status: 'not_accepted', acceptedVersion: null, acceptedAt: null, decidedAt: null };
const current = { ...notAccepted, status: 'current', acceptedVersion: 'test-v1' };

beforeEach(() => {
  fetchConsent.mockReset();
  vi.stubGlobal('crypto', { randomUUID: () => '11111111-1111-4111-8111-111111111111' });
});

it('a consent response from the previous account cannot resume its pending AI action', async () => {
  let finish!: (value: typeof current) => void;
  const saved = new Promise<typeof current>(resolve => { finish = resolve; });
  fetchConsent.mockImplementation((_path: string, init?: RequestInit) => init?.method === 'POST' ? saved : Promise.resolve(notAccepted));
  const run = vi.fn().mockRejectedValue(new ApiError('AI_DATA_CONSENT_REQUIRED', 403));
  function Harness() {
    const [account, setAccount] = useState('A');
    const gate = useAiDataConsentAction(`trip:${account}`);
    return <><button onClick={() => setAccount('B')}>切換帳號</button>
      <button onClick={() => { void gate.attempt('開始 AI 健檢', run); }}>開始</button>{gate.card}</>;
  }
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: '開始' }));
  const card = await screen.findByTestId('ai-data-consent-card');
  fireEvent.click(card.querySelector('input[type=checkbox]')!);
  fireEvent.click(screen.getByRole('button', { name: '同意並繼續' }));
  await waitFor(() => expect(fetchConsent).toHaveBeenCalledWith('/account/ai-data-consent', expect.objectContaining({ method: 'POST' })));
  fireEvent.click(screen.getByRole('button', { name: '切換帳號' }));
  await waitFor(() => expect(screen.queryByTestId('ai-data-consent-card')).not.toBeInTheDocument());
  await act(async () => finish(current));
  expect(run).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId('ai-data-consent-card')).not.toBeInTheDocument();
});

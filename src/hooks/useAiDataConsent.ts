/**
 * AI 資料同意狀態（spec #1553、ADR-0012）。文字與版本都以 server 回的為準，前端不寫死。
 * 任何失敗或不是同意狀態的回應都當「不強制」：旗標關、文案未填妥（enforced=false）時，
 * 所有畫面必須與沒有這個功能時完全相同。
 */
import { useCallback, useEffect, useState } from 'react';
import { typedApi, unwrap } from '../lib/api/typed';

export interface ConsentSection { heading: string; items: string[] }
export interface ConsentText { version: string; title: string; intro: string; sections: ConsentSection[]; withdrawal: string[] }
export interface AiDataConsent {
  status: 'none' | 'valid' | 'stale' | 'withdrawn';
  currentVersion: string;
  acceptedVersion: string | null;
  acceptedAt: string | null;
  text: ConsentText;
  enforced: boolean;
}

const STATUSES = ['none', 'valid', 'stale', 'withdrawn'];
const isConsent = (v: unknown): v is AiDataConsent =>
  !!v && typeof v === 'object' && STATUSES.includes((v as AiDataConsent).status)
  && typeof (v as AiDataConsent).currentVersion === 'string' && !!(v as AiDataConsent).text && Array.isArray((v as AiDataConsent).text.sections);

export function useAiDataConsent() {
  const [consent, setConsent] = useState<AiDataConsent | null>(null);

  useEffect(() => {
    let cancelled = false;
    typedApi.get('/api/account/ai-data-consent')
      .then((r) => { if (!cancelled && isConsent(unwrap(r))) setConsent(unwrap(r)); })
      .catch(() => { /* 讀不到＝不強制 */ });
    return () => { cancelled = true; };
  }, []);

  const apply = (r: unknown) => { if (isConsent(r)) setConsent(r); return r; };

  /** 同意「畫面上看到的版本」。版本已被更新（409）時重讀一次再丟出，讓使用者看到新說明後重新確認。 */
  const accept = useCallback(async () => {
    if (!consent) return;
    try {
      apply(unwrap(await typedApi.post('/api/account/ai-data-consent', { body: { version: consent.currentVersion } })));
    } catch (e) {
      if ((e as { code?: string }).code === 'AI_CONSENT_VERSION_MISMATCH') apply(await typedApi.get('/api/account/ai-data-consent').then(unwrap).catch(() => null));
      throw e;
    }
  }, [consent]);

  const withdraw = useCallback(async () => { apply(unwrap(await typedApi.delete('/api/account/ai-data-consent'))); }, []);

  return { consent, needsConsent: !!consent?.enforced && consent.status !== 'valid', accept, withdraw };
}

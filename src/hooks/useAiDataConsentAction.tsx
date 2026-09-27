import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import AiDataConsentCard, { type AiDataConsentState } from '../components/AiDataConsentCard';
import { apiFetch } from '../lib/apiClient';
import { ApiError } from '../lib/errors';

type Action = { label: string; run: () => Promise<void> };
type Decision = 'accept' | 'decline' | 'revoke';

/** Reuses the chosen inline card at AI actions whose server gate rejects before starting work. */
export function useAiDataConsentAction(scope: string | undefined) {
  const [pending, setPending] = useState<Action | null>(null);
  const [state, setState] = useState<AiDataConsentState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<{ version: string; decision: Decision; id: string } | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const lifetime = useRef({ scope, active: true, sequence: 0 });
  if (lifetime.current.scope !== scope) {
    lifetime.current.active = false;
    lifetime.current.sequence++;
    lifetime.current = { scope, active: true, sequence: 0 };
  }
  const owner = lifetime.current;
  useLayoutEffect(() => {
    owner.active = true;
    setPending(null); setState(null); setBusy(false); setError(null);
    request.current = null;
    returnFocus.current = null;
    return () => { owner.active = false; owner.sequence++; };
  }, [owner]);
  useEffect(() => {
    if (pending || !returnFocus.current) return;
    const target = returnFocus.current;
    returnFocus.current = null;
    if (target.isConnected && !target.hasAttribute('disabled')) target.focus({ preventScroll: true });
  }, [pending]);

  const refresh = async (sequence = owner.sequence) => {
    try {
      const next = await apiFetch<AiDataConsentState>('/account/ai-data-consent');
      if (owner.active && owner.sequence === sequence) { setState(next); setError(null); }
      return next;
    } catch {
      if (owner.active && owner.sequence === sequence) {
        setState(null);
        setError('無法讀取 AI 資料處理說明，請稍後重試。');
      }
      return null;
    }
  };

  const run = async (action: Action, sequence: number) => {
    try {
      await action.run();
      if (owner.active && owner.sequence === sequence) { request.current = null; setPending(null); }
    } catch (cause) {
      if (!owner.active || owner.sequence !== sequence) return;
      if (!(cause instanceof ApiError) ||
        (cause.code !== 'AI_DATA_CONSENT_REQUIRED' && cause.code !== 'AI_DATA_CONSENT_OWNER_REQUIRED')) {
        setPending(null); // The action's own module reports non-consent failures.
        return;
      }
      setPending(action);
      const latest = await refresh(sequence);
      if (owner.active && owner.sequence === sequence &&
        (cause.code === 'AI_DATA_CONSENT_OWNER_REQUIRED' || latest?.status === 'current')) {
        setError('行程擁有者也需要同意目前版本，才能使用此行程的 AI 功能。');
      }
    }
  };

  const attempt = async (label: string, action: () => Promise<void>) => {
    if (!owner.active || busy || pending) return;
    if (document.activeElement instanceof HTMLElement) returnFocus.current = document.activeElement;
    const sequence = ++owner.sequence;
    setBusy(true); setError(null);
    try { await run({ label, run: action }, sequence); }
    finally { if (owner.active && owner.sequence === sequence) setBusy(false); }
  };

  const decide = async (decision: Decision) => {
    if (!owner.active || !pending || !state?.disclosure || busy) return;
    const sequence = ++owner.sequence;
    const version = state.disclosure.version;
    const id = request.current?.version === version && request.current.decision === decision
      ? request.current.id : crypto.randomUUID();
    request.current = { version, decision, id };
    setBusy(true); setError(null);
    try {
      const next = await apiFetch<AiDataConsentState>('/account/ai-data-consent', {
        method: decision === 'revoke' ? 'DELETE' : 'POST',
        body: JSON.stringify({ version, decision, requestId: id }),
      });
      if (!owner.active || owner.sequence !== sequence) return;
      setState(next);
      if (decision === 'accept' && next.status !== 'current') throw new Error('consent not current');
      request.current = null;
      if (decision === 'accept') await run(pending, sequence);
      else setPending(null);
    } catch {
      if (!owner.active || owner.sequence !== sequence) return;
      const next = await refresh(sequence);
      if (!owner.active || owner.sequence !== sequence) return;
      if (decision === 'accept' && next?.status === 'current') {
        request.current = null;
        await run(pending, sequence);
      } else {
        setError('同意狀態未確認，原操作尚未執行。請確認目前版本後重試。');
      }
    } finally { if (owner.active && owner.sequence === sequence) setBusy(false); }
  };

  const retry = async () => {
    if (!owner.active || !pending || busy) return;
    const sequence = ++owner.sequence;
    setBusy(true);
    try {
      const latest = await refresh(sequence);
      if (owner.active && owner.sequence === sequence && latest?.status === 'current') await run(pending, sequence);
    } finally { if (owner.active && owner.sequence === sequence) setBusy(false); }
  };

  const cancel = () => { owner.sequence++; request.current = null; setPending(null); setBusy(false); setError(null); };
  return {
    attempt,
    pendingLabel: pending?.label ?? null,
    card: pending && <AiDataConsentCard state={state} message="" actionLabel={pending.label} busy={busy} error={error}
      onAccept={() => { void decide('accept'); }} onDecline={() => { void decide('decline'); }}
      onRevoke={() => { void decide('revoke'); }} onRetry={() => { void retry(); }} onCancel={cancel} />,
  };
}

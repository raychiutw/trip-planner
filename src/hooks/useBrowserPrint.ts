import {useCallback, useEffect, useRef, useState} from 'react';

/** Browser print cannot report whether the user printed or cancelled. */
export function useBrowserPrint() {
  const [status, setStatus] = useState<'idle' | 'printing' | 'closed' | 'error'>('idle');
  const [error, setError] = useState('');
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);
  const print = useCallback(() => {
    if (cleanup.current) return;
    setStatus('printing'); setError('');
    const finish = (message?: string) => {
      cleanup.current?.();
      setStatus(message ? 'error' : 'closed'); setError(message ?? '');
    };
    const onAfterPrint = () => finish();
    const timer = setTimeout(() => finish('列印回應逾時，請確認列印視窗後重試'), 60000);
    cleanup.current = () => {
      clearTimeout(timer); window.removeEventListener('afterprint', onAfterPrint); cleanup.current = null;
    };
    window.addEventListener('afterprint', onAfterPrint);
    try { window.print(); } catch { finish('無法開啟列印，請重試'); }
  }, []);
  return {print, busy: status === 'printing', error,
    message: status === 'printing' ? '列印視窗開啟中…' : status === 'closed' ? '列印視窗已關閉' : error};
}

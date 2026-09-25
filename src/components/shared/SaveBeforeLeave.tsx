import { useContext, useEffect, useRef, useState } from 'react';
import { UNSAFE_DataRouterContext, useBlocker } from 'react-router-dom';
import type { SaveResult } from '../../hooks/useAutosave';
import ConfirmModal from './ConfirmModal';

interface Props {
  hasPending: () => boolean;
  flush: () => Promise<SaveResult>;
  discard: () => void;
}

/** The editor owns saving; the router owns the blocked destination, including POP. */
function RouteSaveGuard(props: Props) {
  const current = useRef(props);
  current.current = props;
  const blocker = useBlocker(() => current.current.hasPending());
  const [result, setResult] = useState<SaveResult | null>(null);
  const attempt = useRef(0);
  const started = useRef(false);

  const save = async () => {
    const token = ++attempt.current;
    setResult(null);
    let outcome: SaveResult;
    try { outcome = await current.current.flush(); }
    catch (error) { outcome = {status: 'error', error: error instanceof Error ? error.message : '儲存失敗'}; }
    if (attempt.current !== token) return;
    if (outcome.status === 'saved') blocker.proceed?.();
    else setResult(outcome);
  };
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    if (blocker.state !== 'blocked') { started.current = false; return; }
    if (started.current) return;
    started.current = true;
    void saveRef.current();
  }, [blocker.state]);
  useEffect(() => () => { attempt.current++; }, []);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!current.current.hasPending()) return;
      event.preventDefault(); event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, []);

  return <ConfirmModal open={blocker.state === 'blocked'}
    title={result ? '尚有未儲存的變更' : '正在儲存變更'}
    message={result?.status === 'error' ? result.error : result?.status === 'offline'
      ? '目前離線，內容仍保留在此頁。請恢復連線後重試。'
      : '儲存完成後會繼續前往原本的目的地。'}
    warning="放棄只會移除尚未送出的變更；已送出的儲存可能仍會完成。"
    confirmLabel="放棄未儲存內容並離開" cancelLabel="留在此頁"
    onCancel={() => { attempt.current++; blocker.reset?.(); }}
    onConfirm={() => { attempt.current++; current.current.discard(); blocker.proceed?.(); }}>
    {result && <button type="button" className="tp-confirm-btn tp-confirm-btn-cancel" onClick={() => { void save(); }}>重試儲存</button>}
  </ConfirmModal>;
}

export default function SaveBeforeLeave(props: Props) {
  // Isolated legacy MemoryRouter fixtures have no navigation blocker. Production
  // always uses RouterProvider; guarded navigation tests use createMemoryRouter.
  const router = useContext(UNSAFE_DataRouterContext);
  return router ? <RouteSaveGuard {...props} /> : null;
}

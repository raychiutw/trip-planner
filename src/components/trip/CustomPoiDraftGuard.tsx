import { useContext, useEffect, useRef } from 'react';
import { UNSAFE_DataRouterContext, useBlocker } from 'react-router-dom';
import ConfirmModal from '../shared/ConfirmModal';

interface Props {
  hasPending: () => boolean;
  onDiscard: () => void;
  busy: boolean;
}

function RouteGuard(props: Props) {
  const latest = useRef(props);
  latest.current = props;
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (!latest.current.hasPending()) return false;
    // Selecting another day keeps this draft. Changing tab, mode, trip or page
    // can unmount the address picker and must first resolve the draft.
    const current = new URLSearchParams(currentLocation.search);
    const next = new URLSearchParams(nextLocation.search);
    current.delete('day'); next.delete('day'); current.sort(); next.sort();
    return currentLocation.pathname !== nextLocation.pathname || current.toString() !== next.toString();
  });
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (latest.current.hasPending()) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, []);
  return <ConfirmModal open={blocker.state === 'blocked'} title="捨棄未儲存的景點？"
    message="離開會清空尚未加入的自訂景點。" busy={props.busy}
    confirmLabel="捨棄並離開" cancelLabel="繼續編輯"
    onCancel={() => blocker.reset?.()}
    onConfirm={() => { latest.current.onDiscard(); blocker.proceed?.(); }} />;
}

export default function CustomPoiDraftGuard(props: Props) {
  const router = useContext(UNSAFE_DataRouterContext);
  return router ? <RouteGuard {...props} /> : null;
}

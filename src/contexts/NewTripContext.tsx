/**
 * NewTripContext — global "+ 新增行程" entry, single source of truth.
 *
 * Why context (not per-page state): the entry shows up in DesktopSidebar
 * (every authed page), TripsListPage's trailing dashed card, and its empty
 * hero CTA. Wiring per page is fragile (most pages forgot to pass
 * onNewTrip and the button silently no-op'd). Context centralises the
 * modal: any descendant calls useNewTrip().openModal() and the same modal
 * appears + posts /api/trips + navigates to the new trip on success.
 *
 * Provider mounts the modal so it's always available; children that don't
 * use it pay nothing.
 */
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentUser } from '../hooks/useCurrentUser';
import NewTripModal from '../components/trip/NewTripModal';

interface NewTripContextValue {
  openModal: () => void;
}

const NewTripContext = createContext<NewTripContextValue>({ openModal: () => {} });

export function useNewTrip(): NewTripContextValue {
  return useContext(NewTripContext);
}

export function NewTripProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const [open, setOpen] = useState(false);

  const openModal = useCallback(() => setOpen(true), []);
  const closeModal = useCallback(() => setOpen(false), []);

  const handleCreated = useCallback(
    (tripId: string) => {
      setOpen(false);
      navigate(`/trips?selected=${encodeURIComponent(tripId)}`);
    },
    [navigate],
  );

  return (
    <NewTripContext.Provider value={{ openModal }}>
      {children}
      <NewTripModal
        open={open}
        ownerEmail={user?.email ?? ''}
        onClose={closeModal}
        onCreated={handleCreated}
      />
    </NewTripContext.Provider>
  );
}

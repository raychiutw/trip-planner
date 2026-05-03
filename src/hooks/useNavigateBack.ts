import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * useNavigateBack — history-aware back navigation with fallback path.
 *
 * Form-page convention:
 *   - If browser has prior history, navigate(-1) (cancel feels like Back)
 *   - Otherwise navigate to fallback (e.g. '/trips') so users entering via
 *     direct deep-link don't end up at about:blank
 *
 * Replaces the identical handleBack() block in 5 form pages
 * (NewTripPage / EditTripPage / AddStopPage / EntryActionPage / DeveloperAppNewPage).
 */
export function useNavigateBack(fallbackPath: string): () => void {
  const navigate = useNavigate();
  return useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(fallbackPath);
    }
  }, [navigate, fallbackPath]);
}

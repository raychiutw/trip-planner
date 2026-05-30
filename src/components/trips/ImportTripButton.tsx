/**
 * ImportTripButton — titlebar action that imports a trip from an exported JSON.
 *
 * Reads the file, shallow-validates (schemaVersion + size), POSTs to
 * /api/trips/import (the backend does the real validation + insert), then
 * navigates to the freshly-created trip. Import always creates a NEW trip.
 *
 * Design: ~/.gstack/projects/raychiutw-trip-planner/ray-master-design-20260530-101432.md (PR3)
 */
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../shared/Icon';
import { apiFetch } from '../../lib/apiClient';
import { showToast } from '../../lib/toastBus';

const MAX_BYTES = 512 * 1024;

export default function ImportTripButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    if (file.size > MAX_BYTES) {
      showToast('檔案過大（上限 512KB）', 'error', 3000);
      return;
    }
    setBusy(true);
    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        showToast('不是有效的 JSON 檔', 'error', 3000);
        return;
      }
      if (!parsed || typeof parsed !== 'object' || (parsed as { schemaVersion?: unknown }).schemaVersion !== 1) {
        showToast('不支援的匯出格式（需 schemaVersion 1）', 'error', 3000);
        return;
      }
      const res = await apiFetch<{ tripId: string }>('/trips/import', { method: 'POST', body: text });
      showToast('匯入成功', 'success', 2500);
      navigate(`/trips?selected=${encodeURIComponent(res.tripId)}`);
    } catch (err) {
      console.error('[ImportTripButton]', err);
      const detail = (err as { detail?: string })?.detail;
      showToast(detail || '匯入失敗，請稍後再試', 'error', 3000);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={onFile}
        data-testid="trips-import-file"
      />
      <button
        type="button"
        className="tp-titlebar-action"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-label="匯入行程 JSON"
        title="匯入行程 JSON"
        data-testid="trips-import-trigger"
      >
        <Icon name="upload" />
        <span className="tp-titlebar-action-label">{busy ? '匯入中…' : '匯入'}</span>
      </button>
    </>
  );
}

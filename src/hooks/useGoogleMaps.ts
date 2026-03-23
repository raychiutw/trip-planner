/**
 * useGoogleMaps — Google Maps JS SDK 動態載入 hook
 *
 * Singleton pattern：SDK 只載入一次，多個元件共用同一個 google.maps 實例。
 * 使用 @googlemaps/js-api-loader v2 的 setOptions + importLibrary API。
 */

import { useState, useEffect } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

/* ===== 載入狀態 ===== */

export type GoogleMapsStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface UseGoogleMapsReturn {
  status: GoogleMapsStatus;
  error: string | null;
}

/* ===== Singleton 狀態管理 ===== */

let cachedStatus: GoogleMapsStatus = 'idle';
let cachedError: string | null = null;
let initialized = false;

/** 狀態改變時通知所有訂閱者 (re-render) */
const subscribers = new Set<() => void>();

function notify(): void {
  subscribers.forEach((cb) => cb());
}

/**
 * 觸發 SDK 載入（idempotent）。
 * 可在 useGoogleMaps 之外提前呼叫以預熱。
 */
export function loadGoogleMapsSDK(): void {
  if (cachedStatus !== 'idle') return;

  const apiKey = (import.meta as unknown as { env: Record<string, string | undefined> })
    .env.VITE_GOOGLE_MAPS_API_KEY ?? '';

  /* 套用 API key 與版本（必須在第一次 importLibrary 前呼叫）*/
  if (!initialized) {
    initialized = true;
    setOptions({
      key: apiKey,
      v: 'weekly',
    });
  }

  cachedStatus = 'loading';
  notify();

  importLibrary('maps')
    .then(() => {
      cachedStatus = 'ready';
      cachedError = null;
      notify();
    })
    .catch((err: unknown) => {
      cachedStatus = 'error';
      cachedError = err instanceof Error ? err.message : 'Google Maps SDK 載入失敗';
      notify();
    });
}

/* ===== Hook ===== */

export function useGoogleMaps(): UseGoogleMapsReturn {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    /* 訂閱狀態改變 */
    const cb = () => forceUpdate((n) => n + 1);
    subscribers.add(cb);

    /* 若尚未開始載入，觸發載入 */
    if (cachedStatus === 'idle') {
      loadGoogleMapsSDK();
    }

    return () => {
      subscribers.delete(cb);
    };
  }, []);

  return { status: cachedStatus, error: cachedError };
}

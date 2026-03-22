## Context

網站目前無離線支援。useTrip 的 dayCacheRef 只存在記憶體，頁面重整即消失。沒有 Service Worker。

## Goals / Non-Goals

**Goals:**
- App Shell precache（離線也能載入網站）
- API GET 請求用 NetworkFirst 快取（瀏覽過的行程離線可看）
- 離線狀態 UI（提示橫幅 + 編輯停用）

**Non-Goals:**
- 不做離線編輯 + 同步
- 不做手動下載行程
- 不做 IndexedDB（Cache API 足夠）
- 不做 Push Notification

## Decisions

### D1. vite-plugin-pwa 配置
```typescript
import { VitePWA } from 'vite-plugin-pwa';

VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    // Precache App Shell
    globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
    // Runtime cache for API
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/trip-planner-dby\.pages\.dev\/api\/.*/,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api-cache',
          expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 }, // 7 天
          networkTimeoutSeconds: 3,
        },
        method: 'GET',
      },
    ],
  },
  manifest: false, // 已有 public/manifest.json
})
```

### D2. 離線狀態偵測
```typescript
// src/hooks/useOnlineStatus.ts
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return isOnline;
}
```

### D3. 離線 UI 行為
- 離線時：頂部橫幅「📶 離線模式 — 顯示快取資料」
- SpeedDial/FAB disabled + 半透明
- QuickPanel 中的寫入功能 disabled
- 上線時：橫幅改「✅ 已恢復連線」→ 2 秒後淡出

### D4. 不快取的路徑
- POST/PUT/PATCH/DELETE — 所有寫入操作
- /api/requests — 旅伴請求（需即時）
- manage/ 和 admin/ 頁面 — 離線無法使用

## Risks / Trade-offs

- **[Risk] SW 快取可能導致更新延遲** → Mitigation：NetworkFirst 策略，有網路時一律先去 API；registerType: autoUpdate 自動更新 SW
- **[Risk] Cache 過期策略** → Mitigation：7 天 + 100 筆上限，自動淘汰舊快取
- **[Risk] 首次安裝 SW 不會有快取** → Mitigation：正常，使用者需先有網路瀏覽一次才有快取

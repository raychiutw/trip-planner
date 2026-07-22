# ADR-0005：全套切換 Google Maps Platform，不留 fallback

- **Status**：Accepted（v2.23.0 起生效；2026-05-23 owner 明確鎖死）
- **來源**：自 `ARCHITECTURE.md` 的 Key Architectural Decisions 搬入（2026-07-22）

## Context

早期地圖堆疊是 OSM Nominatim + Mapbox + ORS + Leaflet + Haversine 距離估算，資料品質與 license 不一致。

## Decision

Search / Routes / Maps 全部統一到 Google Maps Platform，**舊堆疊整套 ripped out、不留 fallback**。Google `place_id` 成為 canonical POI ID。

## Consequences

- 商業級資料品質 + license 一致。
- **代價**：付費 + 需要配額管理。對應機制：`app_settings` 的 90/50 hysteresis kill switch（`functions/api/_maps_lock.ts`）、`/api/admin/maps-*` 等 8 個 ops endpoint、`scripts/google-quota-monitor.ts` cron、`<TripHealthBanner>` 預警。
- **不可回頭**：owner 2026-05-23 明確指示鎖死 Google Maps Platform，禁止切換到 Mapbox / MapTiler / OSM。要離線地圖用 Static Maps，不做 tile cache。
- Runbook：`docs/runbooks/v2.33-migration-deploy-order.md`。

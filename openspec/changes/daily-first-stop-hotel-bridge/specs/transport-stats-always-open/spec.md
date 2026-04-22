## REMOVED Requirements

### Requirement: 全旅程交通統計 — 常駐展開

**Reason**: 實作「全旅程交通統計」的 UI 區塊已於本次變更（capability `daily-first-stop`）從 React UI 移除。`TripPage.tsx` 不再計算 `tripDrivingStats`、不再渲染 `<TripDrivingStatsCard>`。每日 / 全旅程交通時間改由 `Timeline` 內各 entry 的 `travel` 資訊呈現。

**Migration**: 無等效取代。使用者若需查看交通時間，可展開 Timeline 中各 entry 的 `travel` 描述；全旅程彙總已不提供。匯出 CSV 也不再包含交通統計欄位。

### Requirement: 當日交通（renderDayTransport）保持折疊

**Reason**: 實作「當日交通」的 UI 區塊（`<DayDrivingStatsCard>`）已於本次變更從 `DaySection.tsx` 移除。每日交通資訊改由 Timeline 內 `travel` 物件承載。

**Migration**: 無等效取代。每段交通時間顯示於其出發 entry 的 `travel.desc`。

---

本 capability (`transport-stats-always-open`) 在本次變更歸檔（archive）時將連同所有 requirements 一併移除；原 `openspec/specs/transport-stats-always-open/` 目錄會由 openspec 工具清理。

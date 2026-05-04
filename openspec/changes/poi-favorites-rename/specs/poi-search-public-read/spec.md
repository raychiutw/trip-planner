## ADDED Requirements

### Requirement: GET /api/poi-search 公開讀取

middleware SHALL 將 `GET /api/poi-search` 加入 public-read 白名單，匿名請求視為 anonymous（不拋 401）。同 `/api/route` 與 `/api/public-config` pattern。POST/PATCH/DELETE 等其他 method 對此 path SHALL 維持原 auth gate（method-scoped public-read）。

#### Scenario: Anonymous GET 200
- **WHEN** 匿名使用者 `curl /api/poi-search?q=沖繩&limit=20`
- **THEN** middleware SHALL 通過認證階段（auth.userId = null 但不拋 401）
- **AND** poi-search.ts handler 走 OSM Nominatim proxy → 回 200 + JSON 結果

#### Scenario: V2 authed GET 同樣 200
- **WHEN** authed user GET `/api/poi-search?q=...`
- **THEN** 行為一致（不分 anonymous / authed），handler 純讀取無 user-specific data

#### Scenario: 非 GET method 維持 auth gate
- **WHEN** 匿名使用者 POST /api/poi-search
- **THEN** middleware SHALL 拋 401 AUTH_REQUIRED（method-scoped 白名單只放 GET）

#### Scenario: ExplorePage 搜尋恢復作用
- **WHEN** anonymous 或 authed user 在 `/explore` 輸入「沖繩」按 Enter
- **THEN** ExplorePage runSearch fetch `/api/poi-search?q=沖繩` SHALL 回 200 + 結果
- **AND** UI 渲染 POI 卡片 grid（搜尋 unblock）

#### Scenario: AddStopPage 搜尋恢復作用
- **WHEN** authed user 在 `/trip/:id/add-stop` 切到「搜尋」tab 輸入「拉麵」
- **THEN** usePoiSearch hook fetch `/api/poi-search?q=拉麵` SHALL 回 200
- **AND** UI 渲染搜尋結果

#### Scenario: Cache-Control 不變
- **WHEN** poi-search 回應
- **THEN** response header SHALL 含 `Cache-Control: public, max-age=86400`（CF edge cache 24h）
- **AND** 行為與認證前完全一致（純白名單變更，不動 handler 邏輯）

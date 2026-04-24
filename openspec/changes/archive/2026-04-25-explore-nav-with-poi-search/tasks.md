## 1. POI search API

- [x] 1.1 寫 failing integration test：`GET /api/poi-search?q=沖繩` 回傳 POI list
- [x] 1.2 寫 failing test：invalid query 回 400
- [x] 1.3 寫 failing test：Nominatim 503 時 API 回 503 + retry-after
- [x] 1.4 寫 failing test：Cache hit 時 response header `X-Cache: HIT`
- [x] 1.5 寫 failing test：Category `food` 映射到 Nominatim 對應 tags
- [x] 1.6 建 `functions/api/poi-search.ts` 實作（fetch Nominatim + transform + cache）
- [x] 1.7 wrangler.toml 確認 caches 可用（default cache，無需新 binding）
- [x] 1.8 新 `PoiSearchResult` interface 到 `src/types/api.ts`

## 2. ExploreSearch component

- [x] 2.1 寫 failing test：search bar submit 呼叫 `/api/poi-search`
- [x] 2.2 寫 failing test：category chip 切換更新 API query
- [x] 2.3 寫 failing test：結果 render POI cards
- [x] 2.4 寫 failing test：空結果顯示「無結果」
- [x] 2.5 寫 failing test：API 503 顯示錯誤 toast
- [x] 2.6 建 `src/components/explore/ExploreSearch.tsx`
- [x] 2.7 建 `src/components/explore/ExplorePoiCard.tsx`
- [x] 2.8 建 category filter chips UI

## 3. 儲存池 ExploreSavedPool

- [x] 3.1 寫 failing test：儲存池呼叫 `GET /api/saved-pois` 顯示 list
- [x] 3.2 寫 failing test：POI card 「+ 儲存」呼叫 `POST /api/saved-pois`
- [x] 3.3 寫 failing test：儲存後 card 變「已儲存 ✓」且儲存池立即更新
- [x] 3.4 寫 failing test：重複儲存不 conflict toast（button disabled）
- [x] 3.5 寫 failing test：移除儲存呼叫 `DELETE /api/saved-pois/:id`
- [x] 3.6 建 `src/components/explore/ExploreSavedPool.tsx`

## 4. 加到 trip flow

- [x] 4.1 寫 failing test：儲存池 POI「加到行程」打開 trip picker modal
- [x] 4.2 寫 failing test：選 trip + 選 Day（optional）submit 呼叫 `POST /api/trip-ideas`
- [x] 4.3 寫 failing test：無 trip 時顯示 CTA「先建立 trip」
- [x] 4.4 寫 failing test：只有 1 trip 時 modal 仍顯示 list（不 auto-pick）
- [x] 4.5 寫 failing test：submit 成功後 toast「已加到 XX 的 Ideas」
- [x] 4.6 建 `<TripPickerModal>` component（reusable）

## 5. ExplorePage + 手機 layout

- [x] 5.1 寫 failing test：桌機 ExplorePage render 左右兩 column
- [x] 5.2 寫 failing test：手機 ExplorePage render 上下堆疊 + 儲存池 collapse
- [x] 5.3 replace Phase 2 placeholder `src/pages/ExplorePage.tsx` 實作
- [x] 5.4 手機 category chips horizontal scroll

## 6. 驗證 + ship

- [x] 6.1 Nominatim POC：實際搜尋「沖繩水族館」「首爾燒肉」驗證中文品質
- [x] 6.2 Workers cache 驗證（第 2 次同 query header `X-Cache: HIT`）
- [x] 6.3 Playwright E2E：search → save → add to trip 全流程
- [x] 6.4 `/design-review` screenshot audit
- [x] 6.5 typecheck + 所有 test 綠
- [x] 6.6 `/tp-team` pipeline
- [x] 6.7 Staging → prod ship

## Context

目前 `renderMapLinks` 固定輸出 Google Map + Apple Map 兩個連結，加上可選的 mapcode。所有行程不分國家都是同一套邏輯。韓國因政府限制地圖資料出口，Google Maps 無法導航、大眾運輸路線極少，Naver Map 才是當地實際標準。行程 JSON 目前沒有國家欄位，也沒有 `naverQuery` 欄位。

## Goals / Non-Goals

**Goals:**
- 新增 `meta.countries` 讓行程具備國家感知能力
- 新增 `naverQuery` 欄位，讓韓國 POI 可連結 Naver Map
- 渲染端以「有欄位就顯示」原則新增 Naver Map 按鈕
- 品質規則端依國家限定 `naverQuery`（KR 必填）和 `mapcode`（JP + selfDrive 必填）

**Non-Goals:**
- 不處理 Kakao Map（Naver Map 對觀光客已足夠）
- 不移除 Google/Apple Map（韓國行程仍保留，使用者可自行選擇）
- 不做 meta.countries 自動偵測的 runtime 邏輯（只在 tp-create 時由 LLM 判斷填入）
- 不處理其他國家的特殊地圖（如 Yahoo Japan Map）

## Decisions

### D1：渲染端不看 countries，純粹依欄位有無顯示

**選擇**：`renderMapLinks` 不接收 countries context，只看 `loc.naverQuery` 是否存在。

**替代方案**：傳入 `{ countries, selfDrive }` context 給 renderMapLinks，由 countries 決定顯示。

**理由**：職責分離。品質規則確保「KR 行程有 naverQuery、非 KR 行程沒有」，渲染端只管「有就顯示」。這樣即使未來有人手動在非 KR 行程加 naverQuery，畫面也不會壞。mapcode 沿用相同原則（已是現行做法）。

### D2：Naver Map URL 優先使用精確 place URL

**選擇**：`naverQuery` 優先填 `https://map.naver.com/v5/entry/place/{placeId}`，查不到時 fallback 為 `https://map.naver.com/v5/search/{韓文關鍵字}`。

**替代方案**：全部使用搜尋式 URL。

**理由**：精確連結直接跳到店家頁面，有評價、菜單、電話、營業時間，不會搜到同名店家。tp-create Phase 2 agent 可透過 WebSearch 查到 place ID。

### D3：Naver icon 使用 inline SVG 文字「N」

**選擇**：仿照 Google Map 按鈕的 `<span class="g-icon">G</span>` 模式，用 `<span class="n-icon">N</span>` + 綠色底色。

**替代方案**：引入 Naver 官方 SVG logo、或加入 icons.js ICONS registry。

**理由**：與 Google Map 的 `G` 風格一致，不需引入外部圖片，維持全站 inline SVG / 文字 icon 的設計慣例。Naver 品牌色為 `#03C75A`（綠色）。

### D4：`meta.countries` 使用 ISO 3166-1 alpha-2 國碼陣列

**選擇**：`"countries": ["KR"]`，支援多國行程如 `["KR", "JP"]`。

**替代方案**：單一字串如 `"country": "KR"`。

**理由**：跨國行程（如首爾→福岡）需要多國支援。ISO 標準碼簡潔且無歧義。

### D5：品質規則不新增規則編號，修改既有 R3 URL 驗證規則

**選擇**：在 R3（URL 與 mapcode 驗證）中擴充 naverQuery 驗證 + mapcode 國家條件。

**替代方案**：新增 R13 獨立規則。

**理由**：naverQuery 本質上是 URL 欄位，mapcode 條件修改也在 R3 範疇內，歸入 R3 保持規則集簡潔。同時在 R1（必填欄位）新增 `meta.countries` 必填。

## Risks / Trade-offs

- **Naver place ID 查詢失敗** → 使用搜尋式 URL fallback，品質規則接受兩種格式
- **既有行程 JSON 大量修改** → 非 KR 行程只需加 `meta.countries`（一行），影響小；KR 行程需逐一補 naverQuery，用 agent 並行處理
- **Naver Map URL 格式變更** → Naver 的 `/v5/` 路徑可能隨版本變動，但搜尋式 URL 通常較穩定；精確 place URL 為 permalink，風險較低

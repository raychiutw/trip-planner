# 回覆寫入方法

**⚠️ 重要**：reply 內容含 markdown 換行（`\n`），必須用 `node -e` + `JSON.stringify` 生成 JSON。
**禁止** `printf`、`echo`、或 backtick template literal（Windows bash 會把 literal newline 寫成 0x0A，curl `--data` 再把它去掉，導致 markdown 渲染失敗）。

reply 字串中的換行用 JS 單引號內的 `\n` 表示（會被 JSON.stringify 正確轉義為 `\n`）：

```bash
node -e "require('fs').writeFileSync('/tmp/reply.json', JSON.stringify({reply:'#42\n第一行\n\n第二行', status:'completed'}), 'utf8')"
curl -s -X PATCH \
  -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
  -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
  -H "Content-Type: application/json" \
  --data @/tmp/reply.json \
  "https://trip-planner-dby.pages.dev/api/requests/{requestId}"
```

## DX-C2 — Reply 必須含「我做了什麼」摘要 footer

V2 cutover (migration 0046) 規範：拔掉 mode/intent 分流後，旅伴無法從 mode 字面
推測 skill 是「改了 trip 資料」還是「只回覆」。**所有 reply 必須在末尾加 actions footer**
讓旅伴一眼看到 skill 實際做了什麼：

- 寫資料的 reply：footer 列每個 API 動作的中文摘要 + 是否成功。
  例：「已執行：將 Day 2 的『花笠食堂』替換成『沖繩そば專門店』、travel 已重算。」
- 純回覆的 reply：footer 寫「未修改任何行程資料」。
- dry-run reply：footer 寫「**dry-run 模式**：以下為將執行但 **未實際寫入** 的動作」。

範例 footer：

```
---
**我做了什麼**：
- 替換 Day 2 entry #1287（花笠食堂 → 沖繩そば專門店）
- 重算 Day 2 #1286 → #1287、#1287 → #1288 兩段車程
- 已寫入：trip_entries / trip_pois
```

伴隨 `actions_taken` JSON column（DX-C4 audit log）寫入 trip_requests row：
```json
[
  {"endpoint":"PATCH /api/trips/:id/entries/1287","summary":"replace POI"},
  {"endpoint":"POST /api/trips/:id/entries/1287/trip-pois","summary":"attach 沖繩そば"},
  {"endpoint":"PATCH /api/trips/:id/entries/1287 travel","summary":"recompute"}
]
```

Ray 可 grep `trip_requests.actions_taken` 找誤判 case（reply 說做了 X 但實際只做 Y）。

## 過長 reply

若 reply 內容太長（超過 shell 單行限制），改用暫存 .js 檔：

```bash
# 1. Write a temp .js file
cat > /tmp/write-reply.js << 'ENDSCRIPT'
const reply = [
  '## 標題',
  '',
  '內容第一段',
  '',
  '內容第二段',
].join('\n');
require('fs').writeFileSync('/tmp/reply.json',
  JSON.stringify({ reply, status: 'completed' }), 'utf8');
ENDSCRIPT
# 2. Run it
node /tmp/write-reply.js
# 3. Send to API (same curl as above)
```

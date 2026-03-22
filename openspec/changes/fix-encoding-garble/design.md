## Context

Windows 10 的 console code page 為 CP950。curl 的 `-d` 參數在 shell 中 inline 中文時，bytes 經過 CP950 解讀後再送出，API 端用 UTF-8 解碼得到亂碼。tp-request 的回覆寫入已修復（用 writeFileSync + @file），但 PATCH entry 和其他 skill 仍用 inline。

## Goals / Non-Goals

**Goals:**
- 消除所有 curl inline 中文的亂碼風險（Layer 1）
- API 層攔截非法 UTF-8 body（Layer 2）
- 啟發式偵測亂碼阻止寫入（Layer 3）
- 寫入後異常標記（Layer 4）

**Non-Goals:**
- 不改前端（瀏覽器原生 UTF-8，無風險）
- 不改 PowerShell scheduler（目前只寫 ASCII status）

## Decisions

### D1. SKILL.md 統一安全寫入模式
所有 curl 寫入改為：
```bash
node -e "require('fs').writeFileSync('/tmp/patch.json', JSON.stringify({...}), 'utf8')"
curl -s -X PATCH --data @/tmp/patch.json -H "Content-Type: application/json" ...
```
這是 tp-request 已驗證有效的模式。

### D2. Middleware UTF-8 驗證
```typescript
const cloned = request.clone();
const decoder = new TextDecoder('utf-8', { fatal: true });
try { decoder.decode(await cloned.arrayBuffer()); }
catch { return json({ error: 'Request body is not valid UTF-8' }, 400); }
```

### D3. detectGarbledText 啟發式偵測
檢查 U+FFFD replacement char、連續 Latin Extended bytes（≥3）、C1 控制字元。

### D4. Audit 亂碼標記
在 logAudit 中對 diffJson 掃描，如有亂碼特徵在 diff 中加入 `_encoding_warning: true`。

## Risks / Trade-offs

- **[Risk] Layer 2 的 fatal decode 可能擋住合法但罕見的 byte sequence** → Mitigation：UTF-8 規範嚴格，合法內容不會被誤擋
- **[Risk] Layer 3 的啟發式偵測可能有 false positive** → Mitigation：只檢查 U+FFFD 和高密度 Latin Extended，正常中文不會觸發

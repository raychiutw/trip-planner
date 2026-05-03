# Code Review 規則

從 superpowers:code-reviewer 審查經驗中累積的品質規則。
每次 commit 前需對照檢查。

---

## CR-1: Hook 之間不可直接操作同一 DOM 狀態

- 兩個 hook 不能各自 `classList.add/remove` 同一 class
- 必須透過 **shared React state** 協調，由單一 hook 的 `useEffect` 負責 DOM 同步
- **典型案例**：`useDarkMode` 和 `usePrintMode` 都不能直接操作 `body.dark`

---

## CR-2: useEffect 必須有 cancelled guard

- 所有包含 async 操作的 `useEffect` 必須有 cleanup function 設定 `cancelled = true`
- `.then()` / `.catch()` callback 開頭必須檢查 `if (cancelled) return`
- 防止 Strict Mode 雙重掛載和快速切換造成的 stale state update

```ts
useEffect(() => {
  let cancelled = false;
  fetchData().then((data) => {
    if (cancelled) return; // ← 必要
    setState(data);
  });
  return () => { cancelled = true; };
}, [dep]);
```

---

## CR-3: 不得有重複函式定義

- 同一功能的函式只能存在一個 canonical 位置
- 使用 `Grep` 搜尋函式名稱，確認無 duplicate
- 發現重複時：保留合適位置的版本，其他改為 import

---

## CR-4: 共用 API helper 一致性

- 所有 API 呼叫應使用共用的 `apiFetch` helper
- **例外**：需要檢查 HTTP status code 的呼叫（如 401/403 判斷）可用 raw `fetch`
- 例外情況必須加註釋說明原因

---

## CR-5: 元件包裝不可重複

- 如果子元件已經包含某個 wrapper（如 `<span className="svg-icon">`），父元件不可再包一層
- 使用前先讀子元件的實作確認 DOM 結構

---

## CR-6: 建好的元件必須接入使用

- 已建好並 export 的元件（如 `InfoPanel`）必須在對應頁面中 import 使用
- 不可在頁面中 inline 重新實作元件已提供的功能
- Dead code 如果確定不用則刪除

---

## CR-7: TypeScript type assertions 最小化

- `as never` 完全禁止
- `as unknown as X` 僅允許在 **API boundary**（raw JSON → typed object）
- 優先使用：
  1. 正確定義型別（discriminated union、generic）
  2. Type guard function（`item is Foo`）
  3. 明確的窄型別 assertion（`as FlightsData`）
- 每個檔案的 `as unknown as` 數量不應超過 3 處

---

## CR-8: render loop 中禁止 O(n²) 查找

- `.map()` 內不可用 `.find()` / `.filter()` 查找外部陣列
- 應在 map 外部建立 `Map` 或 `Set`，loop 內用 O(1) `.get()` / `.has()`

---

## CR-9: React key 應使用穩定唯一值

- 有 DB `id` 的資料，key 用 `id` 而非 array index
- 只有純靜態、不會重排序的清單才允許 `key={index}`
- 巢狀 list 的 key 不可與外層 list 重複

---

## CR-10: InfoBoxData 等多態型別應使用 discriminated union 或 type guard

- 同一 interface 的欄位若依 `type` 變化，應使用：
  - **Discriminated union**：每個 variant 有獨立型別
  - **Type guard**：`(item): item is Foo => typeof item === 'object'`
- 禁止 `as unknown as SomeType[]` 強制轉型

---

## 檢查範圍

與 `react-best-practices.md` 相同：

```
src/entries/       *.tsx
src/pages/         *.tsx
src/components/    **/*.tsx
src/hooks/         *.ts
src/lib/           *.ts
src/types/         *.ts
```

另加：
```
functions/api/     **/*.ts（CR-4 適用）
```

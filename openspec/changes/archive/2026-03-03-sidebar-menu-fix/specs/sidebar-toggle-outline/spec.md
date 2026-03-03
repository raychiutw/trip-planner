# Spec: sidebar-toggle-outline

移除 `.sidebar-toggle` 在所有互動狀態下的殘留 outline/border，確保與全站 focus 規範一致。

## 現狀分析

`css/shared.css` 已定義：

```css
button:focus-visible { outline: none; }
.sidebar-toggle:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--blue); }
```

但 `.sidebar-toggle` 在 `:focus`（非 `:focus-visible`）狀態下可能觸發瀏覽器 UA 預設 `outline`（橘色或深色），因為全域規則只覆蓋 `:focus-visible`。

## 修正規格

在 `css/menu.css` 的 `.sidebar-toggle` 主規則中加入 `outline: none;`：

```css
/* 修正後 */
.sidebar-toggle {
    background: none;
    border: none;
    outline: none;          /* 新增：防止所有狀態 outline */
    color: var(--text);
    cursor: pointer;
    width: 32px;
    height: 32px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
}
```

## 狀態對照

| 狀態 | 預期行為 |
|------|---------|
| 預設 | 無 outline，無 border |
| `:hover` | `background: var(--blue-light)` |
| `:focus`（鍵盤或滑鼠點擊後） | 無 outline（由 `outline: none` 覆蓋） |
| `:focus-visible`（鍵盤導覽） | `box-shadow: 0 0 0 2px var(--blue)`（共享規則保留） |
| `:active` | 無額外樣式 |

## 不變動項目

- `css/shared.css` 中 `.sidebar-toggle:focus-visible` 的 `box-shadow` 規則保留（鍵盤存取性）
- `border: none` 已存在於現行規則，無需重複加入

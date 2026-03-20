# Engineer E Report — ThemeArt SVGs (Forest / Sakura / Ocean)

## 修改檔案

- `src/components/trip/ThemeArt.tsx`

## 新增內容

### Forest 主題
- **ForestLightHeader**: 松樹剪影 + 山丘 + 蕨類 + 鳥群
- **ForestDarkHeader**: 金色月牙 + 松樹剪影 + 星星 + 綠色螢火蟲
- **ForestLightDivider**: 葉片形狀 + 蕨類圓點
- **ForestDarkDivider**: 綠色螢火蟲 + 金色星點
- **ForestLightFooter**: 山脈 + 雪帽 + 松樹線
- **ForestDarkFooter**: 山脈剪影 + 松樹 + 星星
- **NavArt forest-light**: 小松樹 + 葉片
- **NavArt forest-dark**: 綠色螢火蟲 + 星星

### Sakura 主題
- **SakuraLightHeader**: 櫻花樹枝 + 花瓣飄落
- **SakuraDarkHeader**: 金色月牙 + 夜櫻枝 + 發光花瓣
- **SakuraLightDivider**: 橢圓花瓣（與 Zen 風格相似但用 Sakura 色）
- **SakuraDarkDivider**: 金色星點 + 粉色光暈
- **SakuraLightFooter**: 櫻花樹林 + 花瓣河
- **SakuraDarkFooter**: 樹木剪影 + 星星 + 發光花瓣
- **NavArt sakura-light**: 小櫻花 + 花瓣
- **NavArt sakura-dark**: 螢火蟲 + 粉色光暈 + 星星

### Ocean 主題
- **OceanLightHeader**: 海浪 + 燈塔 + 帆船 + 海鷗
- **OceanDarkHeader**: 金色月牙 + 燈塔剪影（含光暈）+ 星星 + 柔波
- **OceanLightDivider**: 波浪線 + 氣泡
- **OceanDarkDivider**: 藍色光暈 + 金色星點
- **OceanLightFooter**: 海浪層疊 + 珊瑚提示
- **OceanDarkFooter**: 深海波浪 + 星光倒影
- **NavArt ocean-light**: 小波浪
- **NavArt ocean-dark**: 星星 + 小波浪

## 設計原則遵循

1. Light mode SVG 使用 0.20-0.55 opacity 範圍（由容器額外控制）
2. Dark mode 使用金色月牙 (#FFD080)、亮星 (#FFF4C0) 等暖色，不用暗化 filter
3. 路徑簡潔，避免過大 inline SVG
4. 已更新所有 content maps：DayHeaderArt, DividerArt, FooterArt, NavArt（getNavContent switch）

## 型別檢查

- `npx tsc --noEmit` 無 ThemeArt 相關錯誤

// 場景名稱 → 該場景已知的觸控目標違規（`標籤 寬x高`，CSS px）。只減不增。
// 更新方式：HIG_COLLECT=1 跑 hig-scenes.spec.js，把印出的 HIGWEB 行貼進來。
// 標籤取前 LABEL_MAX 字（hig-scenes.spec.js 截斷用）；清單只需寫穩定的前綴，比對用前綴相符，
// 所以 aria-label 後半段改動不必同步改清單。
const LABEL_MAX = 24;

// 穩定性說明（review e）：條目寫成 `標籤 寬x高` 只是為了和量測輸出（HIGWEB 行）對照；
// 比對（diffViolations）只看「標籤前綴＋最短邊」，寬度不參與，所以字型造成的寬度差幾 px 不會讓棘輪誤紅，
// 條目裡的寬度只是參考值。會讓棘輪失準的是「標籤」與「最短邊」：
//   - 標籤取自 aria-label／title／textContent，被 LABEL_MAX 截斷（日期格標籤含星期與月份，截斷後仍依賴固定的「今天」）；
//   - 最短邊是字型度量（Linux 與 macOS 不同）。
// 這份清單的數值是 Docker（Playwright v1.64.1 noble）暫定值，最終以 CI 的 HIGWEB 輸出為準；
// 不要用 macOS 本機或單次 Docker 的數字硬登記，與 CI 不同時改成 CI 的。

// 違規只看最短邊（< 44），輸入框寬度會隨建置與捲軸差幾 px，所以比對「標籤前綴＋最短邊」。
function parse(v) {
  const m = /^(.*) (\d+)x(\d+)$/.exec(v);
  return m ? { label: m[1].trim(), side: Math.min(Number(m[2]), Number(m[3])) } : { label: v.trim(), side: -1 };
}
const same = (a, b) => a.side === b.side && (a.label.startsWith(b.label) || b.label.startsWith(a.label));

/** 棘輪：fresh = 量到但不在清單（新增違規）；fixed = 在清單但沒量到（已修好該移除）。 */
function diffViolations(found, known) {
  const f = found.map(parse);
  const k = known.map(parse);
  return {
    fresh: found.filter((_, i) => !k.some((x) => same(f[i], x))),
    fixed: known.filter((_, i) => !f.some((x) => same(x, k[i]))),
  };
}

module.exports = {
  LABEL_MAX,
  diffViolations,
  KNOWN_TAP_VIOLATIONS: {
    "login": ["忘記密碼？ 64x19"],
    "login-error": ["忘記密碼？ 64x19"],
    "signup": ["signup-privacy-consent 20x20", "個資條款與隱私權政策 149x24"],
    "trips-list": ["開啟搜尋 24x24"],
    // 「搜尋」鈕只列輸入框：在 CI（Linux 字型）下輸入框被預設寬度撐大，把按鈕擠成 47 px 寬，
    // 文字直排換成「搜／尋」兩行（47x60），兩邊都 ≥ 44 所以不算觸控違規；macOS 字型較窄，按鈕是 62x38。
    // 清單以 CI 為準；那顆按鈕換行本身是排版問題，另案修正，不屬取證範圍。
    "explore": ["搜尋景點、餐廳、住宿… 228x28"],
    "chat": [],
    "map": ["DAY 1 68x34", "DAY 2 68x34", "DAY 3 68x34", "DAY 4 68x34", "DAY 5 68x34", "總覽 54x34"],
    "account": [],
    "developer-apps-new": ["dev-app-new-name 292x42", "dev-app-new-scope-email 13x13", "dev-app-new-scope-offlin 13x13", "dev-app-new-scope-openid 13x13", "dev-app-new-scope-profil 13x13", "dev-app-new-type-confide 13x13", "dev-app-new-type-public 13x13"],
    "trip-detail": ["Day 1 — 7/1（三） — 那霸市區 68x34", "Day 2 — 7/2（四） — 美國村 68x34", "Day 3 — 7/3（五） — 海洋博公園 68x34", "Day 4 — 7/4（六） — 北谷・恩納 68x34", "Day 5 — 7/5（日） — 回程 68x34", "13 min · 6.6 km 286x32", "展開景點：國際通 7x17", "展開景點：波上宮 7x17", "展開景點：牧志公設市場 7x17", "展開景點：首里城 7x17", "更多動作：國際通 32x32", "更多動作：波上宮 32x32", "更多動作：牧志公設市場 32x32", "更多動作：首里城 32x32", "設定時間，編輯起訖時間 79x24"],
    "trip-map": ["DAY 1 68x34", "DAY 2 68x34", "DAY 3 68x34", "DAY 4 68x34", "DAY 5 68x34", "總覽 54x34"],
    "trip-notes": ["刪除航班：中華航空 CI 120 32x32", "拖移航班：中華航空 CI 120 24x24"],
    "trip-print": ["分享連結 106x40", "列印 78x40", "關閉 58x40"],
    "trip-collab": ["共編成員 89x33", "共編成員▾ 111x32", "檢視成員 89x33"],
    "trip-edit": ["上線 72x38", "加入目的地 125x40", "移除 Day 1（會刪除 4 個景點） 36x36", "移除 Day 2（會刪除 1 個景點） 36x36", "移除 Day 3（會刪除 1 個景點） 36x36", "草稿 72x38"],
    "trip-add-stop": ["全部地區 92x27"],
    // ── #1567 行程詳情與編輯流程新增場景（Linux 容器量測）──
    // 寬度（44、248）只是參考；比對只看標籤前綴與最短邊 38（見檔頭說明）。
    "trip-share": ["列印 44x38", "存成 PDF 44x38", "複製到我的行程 248x38"],
    "trip-stop-copy": [],
    "trip-stop-move": [],
    "trip-stop-change-poi": ["全部地區 92x27"],
    "trip-stop-edit": ["分類：景點，點擊更改 78x28", "分類：餐廳，點擊更改 78x28"],
    "trip-add-custom-stop": ["add-custom-stop-hint 20x20", "輸入地址縮放地圖（選填） 253x26"],
    // ── 彈出層場景（只量彈出層本身，不含背景頁面；以 Linux 容器的量測為準）──
    "popup-account-sheet": [],
    // #1587 20：分享對話框的觸控目標已補到 44（✕、區塊 pill、期限分段、輸入框、建立、編輯／重新產生／關閉連結／刪除）。
    // 只剩原生勾選框本身 17x17（label 整列已是 44 高，量測的是 input 元素）；清單以 CI 實測為準。
    "popup-share-link-modal": ["share-anon 17x17"],
    // 桌機寬量測（TripSheet 手機寬是 display:none）；聊天的建議 chip 與送出鈕，和 chat 場景同一組元件。
    "popup-trip-sheet": [],
    // ── #1566：加入行程表單與錨定選單／下拉面板（Linux 容器量測）──
    "add-to-trip": [],
    "favorite-add-to-trip": [],
    "popup-trip-card-menu": [],
    "popup-trip-actions-menu": [],
    // 選單項目高 42，差 2px 到 44（發現 47）。
    // 九筆最短邊都是 42（選單項目高度固定，寬 194 隨選單寬度，比對不看寬度）。
    "popup-rail-row-menu": ["下移一格 194x42", "刪除景點 194x42", "在地圖開啟 194x42", "換景點 194x42", "移到其他天 194x42", "編輯備註 194x42", "編輯景點 194x42", "複製到其他天 194x42", "重新排序 194x42"],
    "popup-trip-select": [],
    // 日期格 40x40、月份切換 36x36；格子標籤是英文全名，所以 spec 把「今天」固定在 2026-11-06（發現 48、49、50）。
    // 36 筆全靠 spec 固定「今天」＝2026-11-06（freezeToday）與 LABEL_MAX=24 截斷才穩定；改任一者整批都要重登記。
    "popup-trip-date-picker": ["Friday, December 4th, 20 40x40", "Friday, November 13th, 2 40x40", "Friday, November 20th, 2 40x40", "Friday, November 27th, 2 40x40", "Monday, November 16th, 2 40x40", "Monday, November 23rd, 2 40x40", "Monday, November 2nd, 20 40x40", "Monday, November 30th, 2 40x40", "Monday, November 9th, 20 40x40", "Saturday, December 5th,  40x40", "Saturday, November 14th, 40x40", "Saturday, November 21st, 40x40", "Saturday, November 28th, 40x40", "Saturday, November 7th,  40x40", "Sunday, November 15th, 2 40x40", "Sunday, November 1st, 20 40x40", "Sunday, November 22nd, 2 40x40", "Sunday, November 29th, 2 40x40", "Sunday, November 8th, 20 40x40", "Thursday, December 3rd,  40x40", "Thursday, November 12th, 40x40", "Thursday, November 19th, 40x40", "Thursday, November 26th, 40x40", "Thursday, November 5th,  40x40", "Today, Friday, November  40x40", "Tuesday, December 1st, 2 40x40", "Tuesday, November 10th,  40x40", "Tuesday, November 17th,  40x40", "Tuesday, November 24th,  40x40", "Tuesday, November 3rd, 2 40x40", "Wednesday, December 2nd, 40x40", "Wednesday, November 11th 40x40", "Wednesday, November 18th 40x40", "Wednesday, November 25th 40x40", "Wednesday, November 4th, 40x40", "上個月 36x36", "下個月 36x36"],
    "popup-trip-time-picker": [],
    // 手機寬：類型 chip 36 高、「加入行程 →」34 高、勾選框 13、搜尋輸入框內層 28（發現 51）。
    "favorites-list": ["住宿 60x36", "全部 60x36", "加入行程 → 99x34", "搜尋收藏 288x28", "景點 60x36", "購物 60x36", "選取 首里城 收藏 13x13", "餐廳 60x36"],
  },
};

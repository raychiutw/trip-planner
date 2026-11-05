// 場景名稱 → 該場景已知的觸控目標違規（`標籤 寬x高`，CSS px）。只減不增。
// 更新方式：HIG_COLLECT=1 跑 hig-scenes.spec.js，把印出的 HIGWEB 行貼進來。
// 標籤取前 LABEL_MAX 字（hig-scenes.spec.js 截斷用）；清單只需寫穩定的前綴，比對用前綴相符，
// 所以 aria-label 後半段改動不必同步改清單。
const LABEL_MAX = 24;

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
    // ── 彈出層場景（只量彈出層本身，不含背景頁面；以 Linux 容器的量測為準）──
    "popup-account-sheet": [],
    // #1587 20：分享對話框的觸控目標已補到 44（✕、區塊 pill、期限分段、輸入框、建立、編輯／重新產生／關閉連結／刪除）。
    // 只剩原生勾選框本身 17x17（label 整列已是 44 高，量測的是 input 元素）；清單以 CI 實測為準。
    "popup-share-link-modal": ["share-anon 17x17"],
    // 桌機寬量測（TripSheet 手機寬是 display:none）；聊天的建議 chip 與送出鈕，和 chat 場景同一組元件。
    "popup-trip-sheet": [],
  },
};

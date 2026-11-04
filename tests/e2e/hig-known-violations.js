// 場景名稱 → 該場景已知的觸控目標違規（`標籤 寬x高`，CSS px）。只減不增。
// 更新方式：HIG_COLLECT=1 跑 hig-scenes.spec.js，把印出的 HIGWEB 行貼進來。
module.exports = {
  KNOWN_TAP_VIOLATIONS: {
    "login": ["忘記密碼？ 64x19"],
    "login-error": ["忘記密碼？ 64x19"],
    "signup": ["signup-privacy-consent 20x20", "個資條款與隱私權政策 149x24"],
    "trips-list": ["開啟搜尋 24x24"],
    "explore": ["搜尋 62x38", "搜尋景點、餐廳、住宿… 228x28"],
    "chat": ["加入適合親子的水族館行程 208x40", "幫我規劃 Day 1 的早午餐 195x40", "把第二天的午餐改成沖繩麵 208x40", "推薦今天附近 30 分鐘車程內的景點 265x40", "送出 40x40"],
    "map": ["DAY 1 68x34", "DAY 2 68x34", "DAY 3 68x34", "DAY 4 68x34", "DAY 5 68x34", "總覽 54x34"],
    "account": ["編輯名稱 32x32"],
    "developer-apps-new": ["dev-app-new-name 292x42", "dev-app-new-scope-email 13x13", "dev-app-new-scope-offlin 13x13", "dev-app-new-scope-openid 13x13", "dev-app-new-scope-profil 13x13", "dev-app-new-type-confide 13x13", "dev-app-new-type-public 13x13"],
    "trip-detail": ["Day 1 — 7/1（三） — 那霸市區 68x34", "Day 2 — 7/2（四） — 美國村 68x34", "Day 3 — 7/3（五） — 海洋博公園 68x34", "Day 4 — 7/4（六） — 北谷・恩納 68x34", "Day 5 — 7/5（日） — 回程 68x34", "交通方式 開車 13 分鐘（點擊變更） 319x32", "展開景點：國際通 7x17", "展開景點：波上宮 7x17", "展開景點：牧志公設市場 7x17", "展開景點：首里城 7x17", "更多動作：國際通 32x32", "更多動作：波上宮 32x32", "更多動作：牧志公設市場 32x32", "更多動作：首里城 32x32", "編輯起訖時間 79x24"],
    "trip-map": ["DAY 1 68x34", "DAY 2 68x34", "DAY 3 68x34", "DAY 4 68x34", "DAY 5 68x34", "總覽 54x34"],
    "trip-notes": ["刪除航班：中華航空 CI 120 32x32", "拖移航班：中華航空 CI 120 24x24"],
    "trip-print": ["分享連結 106x40", "列印 78x40", "關閉 58x40"],
    "trip-collab": ["共編成員 89x33", "共編成員▾ 111x32", "檢視成員 89x33"],
    "trip-edit": ["上線 72x38", "加入目的地 125x40", "移除 Day 1（會刪除 4 個景點） 36x36", "移除 Day 2（會刪除 1 個景點） 36x36", "移除 Day 3（會刪除 1 個景點） 36x36", "草稿 72x38"],
    "trip-add-stop": ["全部地區 92x27"],
  },
};

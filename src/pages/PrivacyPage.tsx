/**
 * 隱私權政策 `/privacy`
 *
 * 視覺 SoT：`docs/design-sessions/2026-07-20-privacy-policy-CONCISE.html`（精簡版）。
 * 與完整版的揭露**範圍相同**，只是「一段話講完一件事」—— Google Play 要求的是
 * 揭露完整，不是篇幅長；讀不完的政策等於沒有政策。
 *
 * ⚠️ 內容是法遵文件，不是文案。每一句都對應可驗證的程式行為，改動前請先確認
 * 程式真的是那樣做：
 *
 *   保留期：mockup 草稿寫「登入稽核 30 天 / 錯誤回報 90 天 / API 紀錄 60 天 /
 *   AI 健檢 30 天…逾期自動清除」。實際上這些清理全在 `scripts/auth-cleanup.js`，
 *   而該檔**沒有任何排程**（`.github/workflows/` 無對應 workflow；
 *   `daily-report.js:341` 的 cleanupOldLogs 已改 no-op 並註明交棒給它）。
 *   逐項核對後 7 項只有「共編邀請」為真（`invitation-cleanup.yml` 每日 03:00）。
 *   照抄草稿即為不實陳述，故改採 owner 給的立場：帳號存續期間保留、刪除時去識別化。
 *
 *   第三方清單：來源是 `public/_headers` 的 CSP `connect-src`/`img-src`
 *   （瀏覽器實際連線對象）加上 `functions/api/` 的 server 端連外，不是憑印象列。
 *
 *   IP：`auth_audit_log` 存雜湊，但 `rate_limit_buckets` 用明文 IP 當 PK
 *   （`migrations/0035`）。所以只能分述，不可籠統說「IP 一律雜湊」。
 *
 * 未登入必須可讀 —— 商店審核員與 Play Console 的隱私權政策欄位都會用匿名狀態
 * 開啟。本元件刻意不呼叫任何 API（有測試鎖）。
 *
 * ⚠️ 揭露的**粒度原則**（owner 2026-07-21：「太詳細了怕會遭受攻擊」）：
 *   寫「接收方的類別、目的、跨境與否、你的權利」——那是法規要求的。
 *   不寫「哪一家廠商、什麼架構、什麼演算法、哪張表存明文」——那不是法規要求，
 *   卻等於把攻擊面攤開。曾寫過「經由我們自行維運的一台主機再透過 Gmail 寄出」
 *   與「流量限制紀錄這部分是明文」，兩句都直接指路。
 *   新增內容前先問：法規要我揭露的是這件事本身，還是它的實作方式？
 *
 * 2026-07-21 移除「既有帳號沿用」段落：owner 確認**系統尚未上線、現有帳號全是
 * 測試帳號**。沒有真實使用者就沒有沿用可言，留著那段反而會讓讀者以為有一批
 * 真實帳號被我們代為推定同意 —— 那是比不揭露更糟的不實陳述。
 * （migration 0090 的回填標記仍在，但對象只有測試帳號；rollback 檔備於
 *   migrations/rollback/0090_*，正式上線前若要清乾淨可用。）
 */
import TitleBar from '../components/shell/TitleBar';
import { useNavigateBack } from '../hooks/useNavigateBack';

/**
 * 與 `functions/api/oauth/signup.ts` 的 `PRIVACY_POLICY_VERSION` 對應。
 * 使用者同意時會把版本寫進 `users.privacy_policy_version`，所以頁面必須顯示
 * 版本，否則日後無從得知某個人當初同意的是哪一版（有測試鎖兩者一致）。
 */
const POLICY_VERSION = '2026-07-20';

/** 管理者聯絡信箱。刪除帳號可自助，這裡是其他請求的窗口。 */
const CONTACT_EMAIL = 'lean.lean@gmail.com';

export default function PrivacyPage() {
  // 固定回首頁而非 history back（v2.33.139 規範）。這頁的入口五花八門 ——
  // 註冊頁、帳號頁、Flutter、Google Play Console 的外部連結 —— history back
  // 的落點不可預測，外部 referrer 甚至會把人送回站外。已登入者到 `/` 會被
  // LandingPage 導回 /trips，兩種身分都有合理落點。
  const handleBack = useNavigateBack('/');

  return (
    <>
      <style>{PRIVACY_STYLES}</style>
      <TitleBar
        className="tp-pp-titlebar"
        title="隱私權政策"
        back={handleBack}
        backLabelVisible
      />

      <main className="tp-pp" data-testid="privacy-page">
        <h1 className="tp-pp-h1">隱私權政策</h1>
        <p className="tp-pp-meta">版本 {POLICY_VERSION}．適用於 Tripline 網站與行動應用程式</p>

        <section className="tp-pp-key">
          <p><b>Tripline 是行程規劃工具。</b>我們收的資料就是讓它運作所需的那些：你的帳號、你建立的行程，以及必要的系統紀錄。</p>
          <p>我們<b>不販售</b>你的個人資料，也<b>不用於廣告投放</b>。</p>
          <p>你可以隨時在「帳號」頁自行刪除帳號。</p>
        </section>

        <h2>我們收什麼</h2>
        <ul>
          <li><b>帳號資料</b>：電子郵件、顯示名稱。密碼不以明文保存，僅存放經加鹽的單向雜湊值。</li>
          <li><b>你建立的內容</b>：行程名稱與日期、景點、住宿、交通安排、備註、收藏地點，以及你自己填寫的航班與訂位資訊。</li>
          <li><b>共編關係</b>：你邀請誰、誰邀請你、各自的權限。</li>
          <li><b>系統紀錄</b>：登入與註冊事件、裝置與瀏覽器資訊、API 存取紀錄、錯誤回報。</li>
        </ul>
        <p>
          登入稽核紀錄中的 IP 位址以雜湊形式儲存。防濫用機制（擋暴力登入與註冊灌爆）
          在運作期間需要暫存連線來源與電子郵件作為識別，這些暫存紀錄會在防護時效
          過後自動刪除。
        </p>

        <h2>為什麼收</h2>
        <ul>
          <li>讓你登入、保存並同步你的行程。</li>
          <li>讓旅伴共同編輯同一份行程。</li>
          <li>提供地圖、路線、天氣等功能。</li>
          <li>維持服務安全（擋暴力登入、濫用與異常流量）與排查錯誤。</li>
        </ul>
        <p>我們不會用你的行程內容做行銷，也不會提供給廣告商。</p>

        <h2>會傳給誰</h2>
        <p>為了提供功能，部分資料會傳送給以下服務。除此之外我們不對外提供你的個人資料。</p>
        <ul>
          <li><b>雲端託管與資料庫服務</b>——存放你的帳號與行程資料，並提供網站流量統計。</li>
          <li><b>地圖與地理資訊服務</b>——你搜尋地點或檢視地圖時，查詢內容與相關位置會送往該服務以取得結果。</li>
          <li><b>天氣資訊服務</b>——查詢天氣時送出行程地點的座標與日期。</li>
          <li><b>錯誤回報服務</b>——發生錯誤時送出錯誤訊息、當下的網址與瀏覽器環境資訊，供我們排除問題。</li>
          <li>
            <b>電子郵件寄送服務</b>——用於寄出驗證信、密碼重設信與共編邀請信。
            內容包含收件的電子郵件地址與連結；共編邀請的情況下，也包含你所填寫的
            受邀者電子郵件地址。
          </li>
          <li><b>系統維運通知</b>——服務發生異常時通知維運人員。通知中的電子郵件地址已遮罩處理。</li>
        </ul>
        <p>
          <b>跨境傳輸：</b>上述服務的伺服器位於台灣境外，其中錯誤回報服務的資料儲存於
          <b>美國</b>。使用本服務即表示你了解資料會傳輸至境外處理。
        </p>

        <h2>第三方應用程式</h2>
        <p>
          Tripline 可作為登入身分提供者，讓第三方應用程式在你授權後存取資料。授權畫面會
          列出該應用程式要求的權限範圍，未取得行程權限者無法讀寫你的行程。你可以在「帳號」
          頁隨時撤銷已授權的應用程式。
        </p>

        <h2>留多久</h2>
        <p>
          <b>你的帳號與行程資料，在帳號存續期間持續保留</b>，直到你自行刪除。系統紀錄
          （登入稽核、裝置紀錄、API 存取紀錄、錯誤回報）目前同樣在帳號存續期間保留，
          我們不宣稱它們會自動過期。
        </p>
        <p>
          少數項目有明確的清除機制：共編邀請在失效或接受滿 30 天後刪除；分享連結過期後
          刪除；流量限制紀錄在時效過後刪除。
        </p>
        <p>
          你刪除帳號時，帳號、行程、收藏與登入紀錄一併刪除；為了維持系統完整性而必須保留的
          操作稽核紀錄，會做<b>去識別化</b>處理——移除可指向你的個人資料，只留下無從辨識
          個人的事件紀錄。
        </p>

        <h2>你可以做什麼</h2>
        <ul>
          <li><b>查看與修改</b>——你的資料都在 app 內，隨時可以編輯。</li>
          <li><b>匯出</b>——行程可匯出成 JSON 檔帶走。</li>
          {/* id 供 Google Play Console 的「帳號刪除網址」欄位深連：
              https://trip-planner-dby.pages.dev/privacy#delete-account
              審核員是從錨點跳進來的，所以這段自己要把刪什麼／留什麼講完整，
              不能只依賴上面的「留多久」章節。 */}
          <li id="delete-account">
            <b>刪除帳號</b>——在 app 內「帳號」頁的「刪除帳號」即可自行完成，無需來信申請。
            刪除是永久性的，無法復原；刪除前會顯示將受影響的行程與共編者數量。
            <br />
            刪除時，你的帳號、你建立的行程、收藏地點、共編關係與登入紀錄都會一併刪除。
            為維持系統完整性而必須保留的操作稽核紀錄，會做<b>去識別化</b>處理——
            移除可指向你的個人資料，只留下無從辨識個人的事件紀錄。
            <br />
            <b>無法登入或已移除 App 時：</b>請從你當初註冊使用的電子郵件地址，
            來信 <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('刪除帳號申請')}`}>{CONTACT_EMAIL}</a>，
            主旨註明「刪除帳號申請」。
            <br />
            <b>身分核對：</b>我們以「來信地址與帳號註冊地址一致」作為核對依據；
            若兩者不同，會回信要求你從註冊地址重新提出。這道核對是必要的——
            沒有它，任何人都能來信刪除他人的帳號。
            <br />
            <b>處理時間：</b>收到申請後 7 個工作天內完成，完成後回信通知。
            刪除範圍與你自行操作完全相同。
          </li>
          <li><b>撤銷授權</b>——在「帳號」頁移除已授權的第三方應用程式。</li>
        </ul>

        <h2>安全</h2>
        <ul>
          <li>全站以 HTTPS 傳輸。</li>
          <li>密碼以加鹽的單向雜湊保存，我們無法還原你的密碼。</li>
          <li>登入設有頻率限制，並記錄登入事件以偵測異常。</li>
          <li>登入稽核紀錄中的 IP 位址以雜湊形式儲存。</li>
        </ul>
        <p>
          我們盡力保護你的資料，但沒有任何線上服務能保證絕對安全。請為本服務使用獨立的密碼。
        </p>

        <h2>兒童</h2>
        <p>
          本服務不以未滿 13 歲的兒童為對象，也不會刻意收集其個人資料。若你發現有兒童在未經
          監護人同意下提供了個人資料，請與我們聯絡，我們會刪除。
        </p>

        <h2>政策變更</h2>
        <p>
          政策內容有實質變更時會更新本頁版本編號。註冊時記錄的同意版本可用於對照你當初
          同意的內容。
        </p>


        <h2>聯絡我們</h2>
        <p>
          對本政策或你的個人資料有任何疑問，請來信 <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>。
        </p>
      </main>
    </>
  );
}

/*
 * 樣式對齊 CONCISE mockup，但兩處刻意不同：
 *   1. `.tp-pp-key` 不加 border —— 專案規範「卡片不加 border，用背景色差區分層級」
 *      （.claude/skills/references/coding-standards.md:22）。mockup 那道框是草稿殘留。
 *   2. sticky nav 改用既有的 <TitleBar/>（含 scroll edge effect），不重刻一份。
 */
const PRIVACY_STYLES = `
.tp-pp {
  max-width: 680px;
  margin: 0 auto;
  padding: 32px 18px 90px;
  color: var(--color-foreground);
  line-height: 1.75;
}
@media (min-width: 761px) {
  .tp-pp { padding: 56px 40px 120px; }
}
.tp-pp-h1 {
  /* large-title(34px) 在窄螢幕過大、title(28px) 又稍小 —— 夾在兩個 token 之間隨寬度縮放 */
  font-size: clamp(var(--font-size-title), 6vw, var(--font-size-large-title));
  font-weight: 900;
  letter-spacing: -0.03em;
  margin: 0 0 8px;
}
.tp-pp-meta {
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
  margin: 0 0 26px;
}
.tp-pp-key {
  border-radius: var(--radius-lg);
  background: var(--color-secondary);
  padding: 18px 20px;
  margin: 0 0 26px;
}
.tp-pp-key p { margin: 0 0 8px; }
.tp-pp-key p:last-child { margin: 0; }
.tp-pp h2 {
  font-size: var(--font-size-title3);
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 34px 0 10px;
}
.tp-pp p { margin: 0 0 14px; }
.tp-pp ul { margin: 0 0 14px; padding-left: 22px; }
.tp-pp li { margin: 5px 0; }
.tp-pp code {
  background: var(--color-tertiary);
  border-radius: var(--radius-sm);
  padding: 1px 6px;
  font-size: var(--font-size-subheadline);
}
.tp-pp a {
  color: var(--color-accent-text);
  font-weight: 600;
}
`;

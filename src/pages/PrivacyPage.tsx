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
 * 未登入必須可讀 —— Google Play 審核員與 Play Console 的隱私權政策欄位都會用
 * 匿名狀態開啟。本元件刻意不呼叫任何 API（有測試鎖）。
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
          <li><b>帳號資料</b>：電子郵件、顯示名稱。密碼不以明文保存，只存加鹽雜湊（PBKDF2-SHA256）。</li>
          <li><b>你建立的內容</b>：行程名稱與日期、景點、住宿、交通安排、備註、收藏地點，以及你自己填寫的航班與訂位資訊。</li>
          <li><b>共編關係</b>：你邀請誰、誰邀請你、各自的權限。</li>
          <li><b>系統紀錄</b>：登入與註冊事件、裝置與瀏覽器資訊、API 存取紀錄、錯誤回報。</li>
        </ul>
        <p>
          登入稽核紀錄中的 IP 位址以雜湊形式儲存，不保留原始位址。但防濫用的流量限制
          紀錄（用於擋暴力登入與註冊灌爆）需要以 IP 與電子郵件本身作為索引，這部分是明文，
          且會在限制時效過後自動刪除。
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
          <li><b>Cloudflare</b>——網站託管、資料庫與流量分析。你的帳號與行程資料存放於此。</li>
          <li><b>Google</b>（地圖、地點、路線、字型）——你搜尋地點或檢視地圖時，查詢內容與位置會送往 Google。</li>
          <li><b>Open-Meteo</b>——查詢天氣時送出行程地點的座標與日期。</li>
          <li><b>Sentry</b>——錯誤回報。發生錯誤時會送出錯誤訊息、當下的網址與瀏覽器資訊。</li>
          <li>
            <b>郵件寄送</b>——驗證信、密碼重設信與共編邀請信，會先經由我們自行維運的一台
            主機，再透過 Gmail 的郵件伺服器寄出。信件內容包含你的電子郵件地址與連結；
            共編邀請的情況下，也包含你所填寫的受邀者電子郵件地址。
          </li>
          <li><b>Telegram</b>——系統異常時通知管理者。通知中的電子郵件已遮罩（例如 <code>r***@example.com</code>）。</li>
        </ul>
        <p>
          <b>跨境傳輸：</b>上述服務的伺服器不在台灣。其中錯誤回報（Sentry）的資料儲存於
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
          </li>
          <li><b>撤銷授權</b>——在「帳號」頁移除已授權的第三方應用程式。</li>
        </ul>

        <h2>安全</h2>
        <ul>
          <li>全站以 HTTPS 傳輸。</li>
          <li>密碼以加鹽雜湊保存，我們無法還原你的密碼。</li>
          <li>登入設有頻率限制，並記錄登入事件以偵測異常。</li>
          <li>登入稽核紀錄中的 IP 以雜湊形式儲存。</li>
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
        <p>
          <b>既有帳號：</b>本政策自 {POLICY_VERSION} 起於註冊流程要求明示同意。在此之前
          建立的帳號屬<b>沿用</b>——我們已於系統中標記其同意狀態為沿用（而非逐一取得的
          明示同意），繼續使用本服務即視為接受現行政策。你隨時可以在「帳號」頁刪除帳號。
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

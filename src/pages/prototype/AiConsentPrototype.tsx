/**
 * PROTOTYPE（throwaway，不進 main）— /prototype/ai-consent?screen=sheet|card|settings&variant=A|B|C&state=…
 *
 * 問題：版本化「AI 資料同意」（spec #1553、ADR-0012）的三個新畫面該長什麼樣？
 *   sheet    — 就地同意：使用者碰到受管制入口被擋時，在原畫面完成同意，同意後接續原操作並保留輸入（3 個變體）
 *   card     — 開新行程的授權卡：把「AI 操作授權」與「AI 資料同意」合成同一步（2 個變體）
 *   settings — 帳號設定「AI 與資料」：查看已同意版本、歷史與撤回（2 個變體）
 * state：none（從未同意）、stale（說明已更新，需重新同意）、withdrawn（已撤回）、valid（有效）、owner-missing（旅伴送出但行程擁有者未同意）
 * 靜態資料與 stub，不呼叫任何 API；只用既有 token，沿用 AiAuthorizeCard／ConfirmModal 的視覺語言。
 * 責任人／聯絡信箱／條款連結是**待填欄位**，以明顯的占位標籤呈現（上線前必填）。
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

type Screen = 'sheet' | 'card' | 'settings';
type StateKey = 'none' | 'stale' | 'withdrawn' | 'valid' | 'owner-missing';

const VERSION = 'ai-data-v1';
const TODO = (label: string) => <span className="ac-todo" title="上線前必填">{`【待填】${label}`}</span>;

const STYLES = `
.ac-shell { min-height: 100dvh; background: var(--color-secondary); color: var(--color-foreground); display: flex; flex-direction: column; align-items: center; padding: 56px 0 0; }
.ac-stage { width: 100%; max-width: 440px; min-height: calc(100dvh - 56px); position: relative; background: var(--color-background); overflow: hidden; }
.ac-bg { padding: 20px 18px; opacity: .55; filter: blur(.4px); pointer-events: none; }
.ac-bg h2 { font-size: 1.25rem; margin: 6px 0 14px; }
.ac-bubble { background: var(--color-accent-subtle); border-radius: var(--radius-lg); padding: 12px 14px; font-size: .9375rem; margin: 8px 0; }
.ac-input { margin-top: 18px; border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 12px 14px; font-size: .9375rem; color: var(--color-muted); }
.ac-scrim { position: absolute; inset: 0; background: rgba(0,0,0,.42); }
.ac-sheet { position: absolute; left: 0; right: 0; bottom: 0; background: var(--color-background); border-radius: 20px 20px 0 0; padding: 10px 18px 22px; max-height: 86%; overflow: auto; box-shadow: 0 -8px 32px rgba(0,0,0,.25); }
.ac-grab { width: 40px; height: 4px; border-radius: 2px; background: var(--color-border); margin: 4px auto 12px; }
.ac-title { font-size: 1.125rem; font-weight: 700; margin: 0 0 6px; letter-spacing: -0.01em; }
.ac-lead { font-size: .875rem; color: var(--color-muted); margin: 0 0 12px; line-height: 1.5; }
.ac-banner { border-radius: var(--radius-md); padding: 10px 12px; font-size: .8125rem; margin-bottom: 12px; display: flex; gap: 8px; align-items: flex-start; }
.ac-banner.info { background: var(--color-accent-subtle); }
.ac-banner.warn { background: var(--color-destructive-bg); color: var(--color-destructive); }
.ac-keep { font-size: .8125rem; color: var(--color-muted); margin: 10px 0 0; display: flex; gap: 6px; align-items: center; }
.ac-acc { border: 1px solid var(--color-border); border-radius: var(--radius-md); margin-bottom: 8px; }
.ac-acc summary { padding: 12px 14px; font-size: .875rem; font-weight: 600; cursor: pointer; min-height: var(--spacing-tap-min); display: flex; align-items: center; justify-content: space-between; }
.ac-acc div { padding: 0 14px 12px; font-size: .8125rem; line-height: 1.55; color: var(--color-foreground); }
.ac-acc ul { margin: 6px 0 0; padding-left: 18px; }
.ac-btn { font: inherit; font-size: 1rem; font-weight: 600; min-height: var(--spacing-tap-min); padding: 12px 18px; border-radius: var(--radius-md); cursor: pointer; border: 1px solid var(--color-border); background: var(--color-background); color: var(--color-foreground); }
.ac-btn.primary { background: var(--color-accent-fill); border-color: var(--color-accent-fill); color: var(--color-accent-foreground); }
.ac-btn[disabled] { opacity: .5; cursor: default; }
.ac-row { display: flex; gap: 10px; margin-top: 12px; } .ac-row > * { flex: 1; }
.ac-link { background: none; border: 0; font: inherit; font-size: .8125rem; color: var(--color-accent-text); text-decoration: underline; cursor: pointer; padding: 8px; min-height: var(--spacing-tap-min); }
.ac-todo { background: #FDE68A; color: #5B4300; border-radius: 4px; padding: 0 4px; font-size: .75rem; font-weight: 700; }
.ac-ver { font-size: .75rem; color: var(--color-muted); }
.ac-chip { display: inline-flex; gap: 6px; align-items: center; border: 1px solid var(--color-border); border-radius: 999px; padding: 6px 10px; font-size: .8125rem; margin: 0 6px 6px 0; }
.ac-full { padding: 18px; }
.ac-sec { margin: 0 0 14px; } .ac-sec h3 { font-size: .9375rem; margin: 0 0 4px; } .ac-sec p, .ac-sec li { font-size: .8125rem; line-height: 1.55; margin: 0; }
.ac-sec ul { margin: 4px 0 0; padding-left: 18px; }
.ac-sticky { position: sticky; bottom: 0; background: var(--color-background); border-top: 1px solid var(--color-border); padding: 12px 18px; }
.ac-check { display: flex; gap: 10px; align-items: flex-start; font-size: .875rem; margin: 12px 0 4px; min-height: var(--spacing-tap-min); }
.ac-check input { width: 22px; height: 22px; margin-top: 1px; }
.ac-ai { border-radius: var(--radius-xl); padding: 16px; background: var(--color-accent-subtle); margin: 18px; }
.ac-ai .row { display: flex; gap: 12px; align-items: flex-start; }
.ac-badge { flex: none; width: 38px; height: 38px; border-radius: var(--radius-lg); background: var(--color-accent-fill); color: var(--color-accent-foreground); display: grid; place-items: center; }
.ac-ai h4 { margin: 0; font-size: .9375rem; } .ac-ai p { margin: 3px 0 0; font-size: .8125rem; color: var(--color-muted); }
.ac-ai .btn { margin-top: 12px; width: 100%; }
.ac-two { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
.ac-pair { background: var(--color-background); border-radius: var(--radius-lg); padding: 10px 12px; display: flex; gap: 10px; align-items: flex-start; font-size: .8125rem; }
.ac-pair b { display: block; font-size: .8125rem; }
.ac-on { display: flex; align-items: center; gap: 8px; margin-top: 12px; background: var(--color-accent-2-subtle); color: var(--color-accent-2-deep); border-radius: var(--radius-lg); padding: 10px 12px; font-size: .8125rem; font-weight: 600; }
.ac-list { margin: 16px 18px; border: 1px solid var(--color-border); border-radius: var(--radius-lg); overflow: hidden; }
.ac-li { padding: 14px; display: flex; gap: 12px; align-items: center; border-bottom: 1px solid var(--color-border); min-height: var(--spacing-tap-min); }
.ac-li:last-child { border-bottom: 0; } .ac-li .t { flex: 1; } .ac-li .t b { display: block; font-size: .9375rem; } .ac-li .t span { font-size: .8125rem; color: var(--color-muted); }
.ac-st { font-size: .75rem; font-weight: 700; padding: 3px 8px; border-radius: 999px; }
.ac-st.valid { background: var(--color-accent-2-subtle); color: var(--color-accent-2-deep); }
.ac-st.stale, .ac-st.none, .ac-st.withdrawn { background: var(--color-accent-subtle); color: var(--color-accent-text); }
.ac-tl { margin: 0 18px 12px; padding-left: 16px; border-left: 2px solid var(--color-border); } .ac-tl li { list-style: none; position: relative; margin: 0 0 14px; font-size: .8125rem; } .ac-tl li::before { content: ''; position: absolute; left: -22px; top: 4px; width: 10px; height: 10px; border-radius: 50%; background: var(--color-accent); }
.ac-bar { position: fixed; left: 50%; top: 8px; transform: translateX(-50%); display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 999px; background: #111; color: #fff; font-size: 12px; z-index: 9999; white-space: nowrap; max-width: 96vw; overflow-x: auto; }
.ac-bar button { background: none; border: 0; color: #fff; font-size: 12px; cursor: pointer; padding: 4px 6px; border-radius: 6px; } .ac-bar button.on { background: #fff3; font-weight: 700; } .ac-bar .sep { opacity: .35; }
`;

const Check = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.7-9.3a1 1 0 00-1.4-1.4L9 10.6 7.7 9.3a1 1 0 10-1.4 1.4l2 2a1 1 0 001.4 0l4-4z" /></svg>
);
const Spark = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l1.9 4.6L18.5 8l-4.6 1.9L12 14l-1.9-4.1L5.5 8l4.6-1.4L12 2z" /><circle cx="18" cy="17" r="2.4" /></svg>
);

/** 同意說明的內容區塊（三個變體共用同一份文字，變的是呈現結構）。 */
function Sections({ open }: { open?: boolean }) {
  const items: Array<[string, React.ReactNode]> = [
    ['我們會交給 AI 的資料', <ul key="a"><li>你在聊天中輸入的要求文字、你的顯示名稱</li><li>你要求處理的<b>那一個行程</b>的內容（日期、景點與店家名稱、備註、預約文字、交通方式與時間）</li><li>不會交給 AI：你的密碼與登入憑證、帳號 email、其他行程</li></ul>],
    ['用途與處理方', <div key="b">只用來完成你這一次提出的行程要求。處理方是 Anthropic（Claude），依處理方條款處理，詳見 {TODO('條款連結')}。景點資料另用 Google Maps 查詢，只含景點名稱或地點識別碼。</div>],
    ['AI 能做什麼、不能做什麼', <div key="c">只能對你指定的那個行程新增、修改內容與景點資料，不能存取檔案、帳號設定或其他行程。每次修改都會留下紀錄。</div>],
    ['你的選擇與撤回', <ul key="d"><li><b>不同意</b>：不影響不需要 AI 的功能，仍可手動編輯與共同編輯。</li><li><b>隨時撤回</b>：帳號設定 → AI 與資料。撤回後新的 AI 要求不再受理，排隊中尚未開始的會被終結。</li><li>已開始的工作不保證能停止，已送出的資料我們無法收回。</li></ul>],
    ['聯絡', <div key="e">責任人：{TODO('責任人名稱')}　聯絡信箱：{TODO('聯絡信箱')}</div>],
  ];
  return <>{items.map(([t, body], i) => (<details className="ac-acc" key={t} open={open && i === 0}><summary>{t}<span aria-hidden>›</span></summary><div>{body}</div></details>))}</>;
}

function Backdrop() {
  return (
    <div className="ac-bg" aria-hidden>
      <h2>沖繩 5 日遊 · AI 聊天</h2>
      <div className="ac-bubble">幫我把第二天下午換成親子景點，少走路</div>
      <div className="ac-bubble" style={{ background: 'var(--color-secondary)' }}>好的，我來看看你的行程…</div>
      <div className="ac-input">把第三天的晚餐改成海鮮，預算 2000 內</div>
    </div>
  );
}

/** 各狀態共用的頂部說明（stale／withdrawn／owner-missing）。 */
function StateBanner({ state }: { state: StateKey }) {
  if (state === 'stale') return <div className="ac-banner info"><Check /><span><b>說明已更新</b>：新增了「保存與撤回方式」的說明。請重新確認後才能繼續使用 AI。你仍可使用不需要 AI 的功能。</span></div>;
  if (state === 'withdrawn') return <div className="ac-banner info"><Check /><span>你先前已撤回同意。要再使用 AI 助理，請重新同意。</span></div>;
  return null;
}

/** 旅伴送出、但行程擁有者尚未同意：沒有「同意」動作（那是 owner 的決定），只告知並讓使用者離開。 */
function OwnerMissing({ onClose }: { onClose?: () => void }) {
  return (
    <>
      <div className="ac-title">暫時無法使用 AI 助理</div>
      <div className="ac-banner warn"><span><b>行程擁有者尚未同意 AI 資料處理。</b>這個行程的內容屬於擁有者，需要他同意後，AI 才能處理你的要求。</span></div>
      <p className="ac-lead">你的訊息已保留，沒有送出。請通知行程擁有者到「帳號設定 → AI 與資料」同意；其餘功能（手動編輯、共同編輯）不受影響。</p>
      <div className="ac-row"><button className="ac-btn primary" type="button" onClick={onClose}>知道了</button></div>
    </>
  );
}

/** (a) 變體 A：底部 sheet（手機）＋三個可展開區，固定兩顆按鈕。 */
function SheetA({ state }: { state: StateKey }) {
  return (
    <div className="ac-stage"><Backdrop /><div className="ac-scrim" />
      <div className="ac-sheet" role="dialog" aria-label="AI 資料同意">
        <div className="ac-grab" />
        {state === 'owner-missing' ? <OwnerMissing /> : (<>
          <div className="ac-title">讓 AI 處理你的行程資料？</div>
          <StateBanner state={state} />
          <p className="ac-lead">AI 助理會依你的要求查詢景點、調整與新增行程內容。請先看清楚交給 AI 的資料，再決定是否同意。</p>
          <Sections open />
          <div className="ac-row"><button className="ac-btn" type="button">暫不使用</button><button className="ac-btn primary" type="button">同意並繼續</button></div>
          <p className="ac-keep"><Check />你輸入的內容已保留，同意後會自動接續送出</p>
          <div className="ac-ver" style={{ marginTop: 6 }}>版本 {VERSION}</div>
        </>)}
      </div>
    </div>
  );
}

/** (a) 變體 B：全頁式（Flutter 全螢幕／桌機頁面），章節完整展開，底部固定按鈕。 */
function SheetB({ state }: { state: StateKey }) {
  return (
    <div className="ac-stage" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="ac-full" style={{ flex: 1, overflow: 'auto' }}>
        {state === 'owner-missing' ? <OwnerMissing /> : (<>
          <div className="ac-ver">AI 資料同意 · 版本 {VERSION}</div>
          <div className="ac-title" style={{ fontSize: '1.375rem', marginTop: 4 }}>讓 AI 處理你的行程資料</div>
          <StateBanner state={state} />
          <div className="ac-sec"><h3>我們會交給 AI 的資料</h3><ul><li>你輸入的要求文字、你的顯示名稱</li><li>你要求處理的那一個行程的內容</li><li>不會交給 AI：密碼、登入憑證、帳號 email、其他行程</li></ul></div>
          <div className="ac-sec"><h3>用途與處理方</h3><p>只用來完成你這一次的要求。處理方：Anthropic（Claude），依處理方條款，詳見 {TODO('條款連結')}。</p></div>
          <div className="ac-sec"><h3>AI 能做什麼</h3><p>只能對你指定的行程新增、修改內容；每次修改都會留下紀錄。</p></div>
          <div className="ac-sec"><h3>不同意與撤回</h3><p>不同意不影響不需要 AI 的功能。可隨時在帳號設定撤回；已開始的工作不保證能停止，已送出的資料無法收回。</p></div>
          <div className="ac-sec"><h3>聯絡</h3><p>責任人：{TODO('責任人名稱')}　信箱：{TODO('聯絡信箱')}</p></div>
        </>)}
      </div>
      {state !== 'owner-missing' && <div className="ac-sticky"><div className="ac-row" style={{ marginTop: 0 }}><button className="ac-btn" type="button">暫不使用</button><button className="ac-btn primary" type="button">同意並繼續</button></div></div>}
    </div>
  );
}

/** (a) 變體 C：重點摘要＋明確勾選「我已閱讀」，勾選後才能同意（要求使用者主動確認）。 */
function SheetC({ state }: { state: StateKey }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="ac-stage"><Backdrop /><div className="ac-scrim" />
      <div className="ac-sheet" role="dialog" aria-label="AI 資料同意">
        <div className="ac-grab" />
        {state === 'owner-missing' ? <OwnerMissing /> : (<>
          <div className="ac-title">三件事，請你確認</div>
          <StateBanner state={state} />
          <div style={{ margin: '8px 0 10px' }}>
            <span className="ac-chip">📤 交給 AI：你的要求＋這個行程內容</span>
            <span className="ac-chip">🏢 處理方：Anthropic（Claude）</span>
            <span className="ac-chip">↩︎ 隨時可撤回</span>
          </div>
          <details className="ac-acc"><summary>完整說明（版本 {VERSION}）<span aria-hidden>›</span></summary><div><Sections /></div></details>
          <label className="ac-check"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />我已閱讀並了解上述內容，同意讓 AI 處理上述資料</label>
          <div className="ac-row"><button className="ac-btn" type="button">暫不使用</button><button className="ac-btn primary" type="button" disabled={!ok}>同意並繼續</button></div>
        </>)}
      </div>
    </div>
  );
}

/** (b) 開新行程的授權卡 A：一張卡、兩行摘要、單一按鈕「同意並授權 AI」。 */
function CardA({ state }: { state: StateKey }) {
  const done = state === 'valid';
  return (
    <div className="ac-stage"><div className="ac-bg" style={{ opacity: 1, filter: 'none' }}><h2>建立新行程</h2><div className="ac-input">行程名稱：沖繩 5 日遊</div></div>
      <div className="ac-ai">
        <div className="row"><div className="ac-badge"><Spark /></div><div><h4>讓 AI 幫你把行程填滿</h4><p>AI 會以你的身分安排景點、餐廳、交通，過程中會處理你的行程資料。</p></div></div>
        {done ? <div className="ac-on"><Check />已授權並同意 · 版本 {VERSION} · 可在「AI 與資料」撤回</div> : (<>
          <StateBanner state={state} />
          <div className="ac-two"><div className="ac-pair"><Check /><div><b>AI 操作授權</b>讓 AI 以你的身分修改你的行程</div></div><div className="ac-pair"><Check /><div><b>AI 資料同意</b>把你的行程內容與要求交給 Anthropic（Claude）處理 · <button className="ac-link" type="button" style={{ padding: 0, minHeight: 0 }}>查看完整說明</button></div></div></div>
          <button className="ac-btn primary btn" type="button" style={{ marginTop: 12, width: '100%' }}>同意並授權 AI</button>
        </>)}
      </div>
    </div>
  );
}

/** (b) 開新行程的授權卡 B：卡片內兩個獨立勾選列，兩者都勾才能按鈕；操作授權與資料同意仍可分別理解。 */
function CardB({ state }: { state: StateKey }) {
  const [a, setA] = useState(state === 'valid');
  const [b, setB] = useState(state === 'valid');
  const done = state === 'valid';
  return (
    <div className="ac-stage"><div className="ac-bg" style={{ opacity: 1, filter: 'none' }}><h2>建立新行程</h2><div className="ac-input">行程名稱：沖繩 5 日遊</div></div>
      <div className="ac-ai">
        <div className="row"><div className="ac-badge"><Spark /></div><div><h4>讓 AI 幫你把行程填滿</h4><p>需要兩項許可：一項讓 AI 動手，一項讓 AI 看得到資料。</p></div></div>
        {done ? <div className="ac-on"><Check />已授權並同意 · 版本 {VERSION}</div> : (<>
          <StateBanner state={state} />
          <label className="ac-check"><input type="checkbox" checked={a} onChange={(e) => setA(e.target.checked)} /><span><b>允許 AI 以我的身分修改我的行程</b><br /><span className="ac-ver">AI 操作授權</span></span></label>
          <label className="ac-check"><input type="checkbox" checked={b} onChange={(e) => setB(e.target.checked)} /><span><b>同意把行程內容與要求交給 Anthropic（Claude）處理</b><br /><span className="ac-ver">AI 資料同意 · 版本 {VERSION} · <button className="ac-link" type="button" style={{ padding: 0, minHeight: 0 }}>查看說明</button></span></span></label>
          <button className="ac-btn primary" type="button" disabled={!(a && b)} style={{ marginTop: 10, width: '100%' }}>開始使用 AI</button>
        </>)}
      </div>
    </div>
  );
}

/** (c) 帳號設定「AI 與資料」A：清單式（兩列：操作授權、資料同意），各有狀態與動作。 */
function SettingsA({ state }: { state: StateKey }) {
  const valid = state === 'valid';
  const label = { valid: '已同意', stale: '需重新同意', withdrawn: '已撤回', none: '尚未同意', 'owner-missing': '尚未同意' }[state];
  return (
    <div className="ac-stage"><div className="ac-bg" style={{ opacity: 1, filter: 'none' }}><div className="ac-ver">帳號設定</div><h2>AI 與資料</h2></div>
      <div className="ac-list">
        <div className="ac-li"><div className="t"><b>AI 操作授權</b><span>讓 AI 以你的身分修改你的行程</span></div><span className="ac-st valid">已授權</span></div>
        <div className="ac-li"><div className="t"><b>AI 資料同意</b><span>{valid ? `版本 ${VERSION} · 2026/11/03 同意` : state === 'stale' ? '你同意的是舊版，說明已更新' : '尚未同意目前版本'}</span></div><span className={`ac-st ${state}`}>{label}</span></div>
        <div className="ac-li"><div className="t"><span>查看目前的說明（版本 {VERSION}）</span></div><button className="ac-link" type="button">查看</button></div>
        {valid && <div className="ac-li"><div className="t"><span>撤回後，新的 AI 要求不再受理；已開始的工作不保證能停止。</span></div><button className="ac-btn" type="button" style={{ color: 'var(--color-destructive)' }}>撤回同意</button></div>}
        {!valid && <div className="ac-li"><div className="t"><span>同意後即可使用 AI 助理</span></div><button className="ac-btn primary" type="button">重新同意</button></div>}
      </div>
    </div>
  );
}

/** (c) 帳號設定「AI 與資料」B：卡片＋同意歷史時間軸（資料同意是只追加的事件，歷史可稽核、對使用者也透明）。 */
function SettingsB({ state }: { state: StateKey }) {
  const valid = state === 'valid';
  return (
    <div className="ac-stage"><div className="ac-bg" style={{ opacity: 1, filter: 'none' }}><div className="ac-ver">帳號設定</div><h2>AI 與資料</h2></div>
      <div className="ac-ai" style={{ margin: '0 18px 14px' }}>
        <div className="row"><div className="ac-badge"><Spark /></div><div><h4>{valid ? 'AI 助理已開啟' : state === 'stale' ? 'AI 助理已暫停：說明已更新' : state === 'withdrawn' ? 'AI 助理已關閉' : 'AI 助理尚未開啟'}</h4><p>{valid ? `你同意的是版本 ${VERSION}（2026/11/03）。` : '同意前，AI 聊天、行程健檢與 AI 筆記無法使用；其餘功能不受影響。'}</p></div></div>
        {valid ? <button className="ac-btn btn" type="button" style={{ marginTop: 12, width: '100%', color: 'var(--color-destructive)' }}>撤回同意</button> : <button className="ac-btn primary btn" type="button" style={{ marginTop: 12, width: '100%' }}>查看說明並同意</button>}
      </div>
      <div style={{ margin: '0 18px 8px', fontWeight: 700, fontSize: '.9375rem' }}>同意紀錄</div>
      <ul className="ac-tl">
        {state === 'withdrawn' && <li><b>撤回同意</b><br /><span className="ac-ver">2026/11/05 · 版本 {VERSION}</span></li>}
        {(valid || state === 'withdrawn' || state === 'stale') && <li><b>同意 AI 資料處理</b><br /><span className="ac-ver">2026/11/03 · 版本 {state === 'stale' ? 'ai-data-v0（舊版）' : VERSION}</span></li>}
        {state === 'none' && <li><b>尚無紀錄</b></li>}
      </ul>
    </div>
  );
}

const SCREENS: Record<Screen, { label: string; variants: Array<{ key: string; name: string; C: (p: { state: StateKey }) => React.JSX.Element }>; states: StateKey[] }> = {
  sheet: { label: '就地同意', states: ['none', 'stale', 'withdrawn', 'owner-missing'], variants: [{ key: 'A', name: '底部 sheet＋可展開區', C: SheetA }, { key: 'B', name: '全頁式', C: SheetB }, { key: 'C', name: '重點摘要＋勾選確認', C: SheetC }] },
  card: { label: '開新行程合併卡', states: ['none', 'stale', 'valid'], variants: [{ key: 'A', name: '單一按鈕', C: CardA }, { key: 'B', name: '兩個勾選', C: CardB }] },
  settings: { label: 'AI 與資料', states: ['valid', 'stale', 'withdrawn', 'none'], variants: [{ key: 'A', name: '清單式', C: SettingsA }, { key: 'B', name: '卡片＋歷史時間軸', C: SettingsB }] },
};
const STATE_LABEL: Record<StateKey, string> = { none: '未同意', stale: '說明已更新', withdrawn: '已撤回', valid: '已同意', 'owner-missing': '旅伴被 owner 擋' };

export default function AiConsentPrototype() {
  const [sp, setSp] = useSearchParams();
  const screen = (['sheet', 'card', 'settings'].includes(sp.get('screen') ?? '') ? sp.get('screen') : 'sheet') as Screen;
  const def = SCREENS[screen];
  const variant = (sp.get('variant') ?? 'A').toUpperCase();
  const v = def.variants.find((x) => x.key === variant) ?? def.variants[0]!;
  const st = (def.states.includes(sp.get('state') as StateKey) ? sp.get('state') : def.states[0]) as StateKey;
  const set = (k: string, val: string) => { const n = new URLSearchParams(sp); n.set(k, val); if (k === 'screen') { n.delete('variant'); n.delete('state'); } setSp(n, { replace: true }); };
  useEffect(() => { document.title = `prototype · ${def.label} ${v.key}`; }, [def.label, v.key]);
  const Current = v.C;
  return (
    <main className="ac-shell" data-testid="prototype-ai-consent">
      <style>{STYLES}</style>
      <Current state={st} />
      <div className="ac-bar">
        {(Object.keys(SCREENS) as Screen[]).map((s) => <button key={s} className={s === screen ? 'on' : ''} onClick={() => set('screen', s)}>{SCREENS[s].label}</button>)}
        <span className="sep">|</span>
        {def.variants.map((x) => <button key={x.key} className={x.key === v.key ? 'on' : ''} onClick={() => set('variant', x.key)}>{x.key} {x.name}</button>)}
        <span className="sep">|</span>
        {def.states.map((s) => <button key={s} className={s === st ? 'on' : ''} onClick={() => set('state', s)}>{STATE_LABEL[s]}</button>)}
      </div>
    </main>
  );
}

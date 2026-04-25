/**
 * Email HTML templates — V2-P3 transactional emails (繁體中文)
 *
 * 設計原則 (per V2 design doc Email section)：
 *   - Inline CSS（外部 CSS 在 email client 不可靠）
 *   - Table-based layout（max compatibility）
 *   - Terracotta brand color（#D97848）
 *   - 簡單 HTML，不用 image / external font
 *   - 同時提供 plain text fallback（spam filter 友好）
 *
 * Templates:
 *   - emailVerification(verifyUrl, displayName?) — 註冊後驗 email
 *   - passwordReset(resetUrl, displayName?) — 忘記密碼重設
 *   - passwordChangedConfirm(displayName?) — 密碼已更改通知
 *
 * 不放 user-controlled HTML 進 template — 全部 user input (displayName) 過
 * `escapeHtml` 防 XSS。連結 URL 由 caller 組好（已 encodeURIComponent token）。
 */

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

const BRAND_COLOR = '#D97848';
const BRAND_DEEP = '#B85C2E';
const BG_COLOR = '#FFFBF5';
const TEXT_COLOR = '#2A1F18';
const MUTED_COLOR = '#6F5A47';

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function shellHtml(innerHtml: string): string {
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:24px; font-family: 'Helvetica Neue', Arial, 'Noto Sans TC', sans-serif; background:${BG_COLOR}; color:${TEXT_COLOR}; line-height:1.5;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px; margin:0 auto;">
<tr><td>
<div style="text-align:center; padding:24px 0; font-size:18px; font-weight:800; letter-spacing:-0.02em;">
  <span style="color:${BRAND_COLOR};">●</span> Tripline
</div>
${innerHtml}
<div style="text-align:center; padding:24px 0 0; font-size:12px; color:${MUTED_COLOR};">
  本信件自動發出，請勿直接回覆。<br>
  Tripline · 行程共享網站
</div>
</td></tr>
</table>
</body>
</html>`;
}

function ctaButton(url: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto;">
<tr><td style="border-radius:10px; background:${BRAND_COLOR};">
<a href="${escapeHtml(url)}" style="display:inline-block; padding:14px 32px; color:#fff; text-decoration:none; font-size:15px; font-weight:600; border-radius:10px;">${escapeHtml(label)}</a>
</td></tr>
</table>`;
}

export function emailVerification(verifyUrl: string, displayName?: string | null): EmailTemplate {
  const greetName = displayName ? `${escapeHtml(displayName)}，` : '';
  return {
    subject: '驗證您的 Tripline 帳號',
    html: shellHtml(`
<div style="background:#fff; border:1px solid #EADFCF; border-radius:14px; padding:32px;">
  <h2 style="margin:0 0 16px; font-size:22px; font-weight:800;">歡迎加入 Tripline${displayName ? `，${escapeHtml(displayName)}` : ''}</h2>
  <p style="margin:0 0 16px; font-size:15px;">${greetName}請點擊下方按鈕驗證您的 email，完成註冊。</p>
  ${ctaButton(verifyUrl, '驗證 Email')}
  <p style="margin:0 0 8px; font-size:13px; color:${MUTED_COLOR};">或複製以下連結到瀏覽器：</p>
  <p style="margin:0 0 16px; font-size:12px; color:${MUTED_COLOR}; word-break:break-all;"><a href="${escapeHtml(verifyUrl)}" style="color:${BRAND_DEEP}; text-decoration:none;">${escapeHtml(verifyUrl)}</a></p>
  <p style="margin:0; font-size:12px; color:${MUTED_COLOR};">此連結 24 小時內有效。如果不是您本人申請，請忽略此信件。</p>
</div>
`),
    text: `歡迎加入 Tripline${displayName ? `，${displayName}` : ''}\n\n請點擊以下連結驗證您的 email：\n${verifyUrl}\n\n連結 24 小時內有效。如果不是您本人申請，請忽略此信件。\n\n— Tripline`,
  };
}

export function passwordReset(resetUrl: string, displayName?: string | null): EmailTemplate {
  return {
    subject: '重設您的 Tripline 密碼',
    html: shellHtml(`
<div style="background:#fff; border:1px solid #EADFCF; border-radius:14px; padding:32px;">
  <h2 style="margin:0 0 16px; font-size:22px; font-weight:800;">重設密碼${displayName ? `，${escapeHtml(displayName)}` : ''}</h2>
  <p style="margin:0 0 16px; font-size:15px;">我們收到您重設密碼的請求。點擊下方按鈕設定新密碼：</p>
  ${ctaButton(resetUrl, '重設密碼')}
  <p style="margin:0 0 8px; font-size:13px; color:${MUTED_COLOR};">或複製以下連結到瀏覽器：</p>
  <p style="margin:0 0 16px; font-size:12px; color:${MUTED_COLOR}; word-break:break-all;"><a href="${escapeHtml(resetUrl)}" style="color:${BRAND_DEEP}; text-decoration:none;">${escapeHtml(resetUrl)}</a></p>
  <p style="margin:0 0 8px; font-size:13px; color:${MUTED_COLOR};">為了您的帳號安全：</p>
  <ul style="margin:0; padding-left:20px; font-size:12px; color:${MUTED_COLOR};">
    <li>此連結 1 小時內有效</li>
    <li>連結只能使用一次</li>
    <li>重設後您所有裝置將被登出，需重新登入</li>
  </ul>
  <p style="margin:16px 0 0; font-size:12px; color:${MUTED_COLOR};">如果不是您本人申請，可忽略此信件。您的密碼不會變更。</p>
</div>
`),
    text: `重設密碼${displayName ? `，${displayName}` : ''}\n\n我們收到您重設密碼的請求。請點擊以下連結設定新密碼：\n${resetUrl}\n\n· 此連結 1 小時內有效\n· 連結只能使用一次\n· 重設後您所有裝置將被登出\n\n如果不是您本人申請，可忽略此信件。\n\n— Tripline`,
  };
}

export function passwordChangedConfirm(displayName?: string | null): EmailTemplate {
  return {
    subject: 'Tripline 密碼已更改',
    html: shellHtml(`
<div style="background:#fff; border:1px solid #EADFCF; border-radius:14px; padding:32px;">
  <h2 style="margin:0 0 16px; font-size:22px; font-weight:800;">密碼已更改${displayName ? `，${escapeHtml(displayName)}` : ''}</h2>
  <p style="margin:0 0 16px; font-size:15px;">您的 Tripline 帳號密碼已成功更改。為了安全，您所有裝置上的登入已自動登出。</p>
  <p style="margin:0 0 8px; font-size:14px; color:${MUTED_COLOR};">如果不是您本人操作：</p>
  <ul style="margin:0; padding-left:20px; font-size:13px; color:${MUTED_COLOR};">
    <li>立即重設密碼防止帳號被盜用</li>
    <li>檢查最近的登入裝置（設定 → 登入裝置）</li>
    <li>有疑問請聯絡我們</li>
  </ul>
</div>
`),
    text: `密碼已更改${displayName ? `，${displayName}` : ''}\n\n您的 Tripline 帳號密碼已成功更改。為了安全，您所有裝置已自動登出。\n\n如果不是您本人操作：\n· 立即重設密碼\n· 檢查最近的登入裝置\n· 有疑問請聯絡我們\n\n— Tripline`,
  };
}

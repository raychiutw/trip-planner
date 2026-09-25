/** Human-readable descriptions shared by consent and existing grant review. */
export const SCOPE_DESCRIPTIONS: Record<string, string> = {
  openid: '識別您的身分（唯一 ID）',
  profile: '基本個人資料（名稱、頭像）',
  email: '您的電子郵件地址',
  offline_access: '即使您離線也可存取（refresh token）',
  'trips:read': '讀取您的行程資料',
  'trips:write': '建立 / 修改您的行程',
};

/** Scopes available to developer self-service registration; privileged grants stay server-managed. */
export const SELF_SERVICE_SCOPES = ['openid', 'profile', 'email', 'offline_access'] as const;

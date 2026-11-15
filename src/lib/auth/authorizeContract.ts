/**
 * 授權頁（/oauth/authorize）與 api 的契約：網址參數的白名單值、端點路徑。
 * 型別一律從 api 的 OpenAPI（src/api/schema.d.ts）推導，api 改 enum 時這裡編譯就會紅，不用 `as` 強轉。
 */
import type { paths } from '../../api/schema';

type AuthorizeQuery = NonNullable<paths['/api/oauth/authorize']['get']['parameters']['query']>;

/** 網址 biometric_hint（api 的 enum）。 */
export type BiometricHint = NonNullable<AuthorizeQuery['biometric_hint']>;

/** 網址 reauth：OpenAPI 只有 biometric_intent（enable｜disable）的 schema；`login`（單獨 prompt=login）只寫在 authorize 的回應描述文字裡，沒有 schema，web 自己補。 */
export type ReauthValue = NonNullable<AuthorizeQuery['biometric_intent']> | 'login';

/** intent 呼叫送出的值（api 的 enum；null 是清除，web 不用）。 */
export type IntentValue = NonNullable<
  paths['/api/oauth/authorize/requests/{id}/intent']['post']['requestBody']['content']['application/json']['intent']
>;

/** hint → 專門鈕文字與圖示；只供顯示，不是安全依據。Record 以 enum 為 key：api 新增值時編譯會要求補上。 */
export const BIOMETRIC_BUTTON: Record<BiometricHint, { text: string; faceId: boolean }> = {
  faceid: { text: '用 Face ID 登入', faceId: true },
  touchid: { text: '用 Touch ID 登入', faceId: false },
  generic: { text: '用生物辨識登入', faceId: false },
};

/** reauth → 登入頁標題。 */
export const REAUTH_TITLE: Record<ReauthValue, string> = {
  enable: '開啟生物辨識登入，請重新輸入密碼',
  disable: '關閉生物辨識登入，請重新輸入密碼',
  login: '請重新輸入密碼登入',
};

const has = (map: object, key: string) => Object.prototype.hasOwnProperty.call(map, key);

/** 網址值不在白名單（含 'constructor' 等原型鏈屬性）一律回 null，當作沒帶。 */
export function parseBiometricHint(raw: string | null): BiometricHint | null {
  const isHint = (v: string): v is BiometricHint => has(BIOMETRIC_BUTTON, v);
  return raw !== null && isHint(raw) ? raw : null;
}

export function parseReauth(raw: string | null): ReauthValue | null {
  const isReauth = (v: string): v is ReauthValue => has(REAUTH_TITLE, v);
  return raw !== null && isReauth(raw) ? raw : null;
}

export const REQUEST_ID = /^[A-Za-z0-9_-]{1,128}$/;

type RequestPath = Extract<keyof paths, `/api/oauth/authorize/requests/{id}${string}`>;
/** 端點路徑樣板（`satisfies` 讓拼錯或 api 改路徑時編譯失敗）。 */
export const AUTHORIZE_PATH = {
  request: '/api/oauth/authorize/requests/{id}',
  approve: '/api/oauth/authorize/requests/{id}/approve',
  intent: '/api/oauth/authorize/requests/{id}/intent',
} as const satisfies Record<string, RequestPath>;

export const USERINFO_PATH = '/api/oauth/userinfo' as const satisfies keyof paths;

export function authorizePath(key: keyof typeof AUTHORIZE_PATH, requestId: string): string {
  return AUTHORIZE_PATH[key].replace('{id}', requestId);
}

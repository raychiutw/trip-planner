/** GET /api/account 的帳號預覽（刪除影響範圍、hasPassword）。 */
export interface AccountPreview {
  /** 有 local 密碼身分 → 用密碼確認；純 OAuth → 先完成 Google 重新驗證，再輸入確認字串 */
  hasPassword: boolean;
  reauthProvider: 'google' | null;
  reauthenticated: boolean;
  tripsOwned: number;
  collaboratorsAffected: number;
}

export function isAccountPreview(value: unknown): value is AccountPreview {
  if (!value || typeof value !== 'object') return false;
  const preview = value as Record<string, unknown>;
  return typeof preview.hasPassword === 'boolean'
    && (preview.hasPassword || ((preview.reauthProvider === 'google' || preview.reauthProvider === null)
      && typeof preview.reauthenticated === 'boolean'))
    && typeof preview.tripsOwned === 'number' && Number.isSafeInteger(preview.tripsOwned) && preview.tripsOwned >= 0
    && typeof preview.collaboratorsAffected === 'number' && Number.isSafeInteger(preview.collaboratorsAffected)
    && preview.collaboratorsAffected >= 0;
}

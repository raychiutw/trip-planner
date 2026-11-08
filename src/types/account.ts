/** GET /api/account 的帳號預覽（刪除影響範圍、hasPassword）。api 仍回的已棄用相容欄位（Google 重新驗證時代）一律不讀。 */
export interface AccountPreview {
  /** 有 local 密碼身分 → 用密碼確認刪除；沒有 → 無法刪除（fail-closed，ADR-0009 已被取代） */
  hasPassword: boolean;
  tripsOwned: number;
  collaboratorsAffected: number;
}

export function isAccountPreview(value: unknown): value is AccountPreview {
  if (!value || typeof value !== 'object') return false;
  const preview = value as Record<string, unknown>;
  return typeof preview.hasPassword === 'boolean'
    && typeof preview.tripsOwned === 'number' && Number.isSafeInteger(preview.tripsOwned) && preview.tripsOwned >= 0
    && typeof preview.collaboratorsAffected === 'number' && Number.isSafeInteger(preview.collaboratorsAffected)
    && preview.collaboratorsAffected >= 0;
}

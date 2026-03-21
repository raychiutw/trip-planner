/**
 * validateDayBody — days PUT 端點的 server-side 必填驗證邏輯
 * 抽成獨立函式以便 unit test 直接覆蓋，不需啟動完整 server。
 */

export interface DayBody {
  date?: string;
  dayOfWeek?: string;
  label?: string;
  [key: string]: unknown;
}

export interface ValidationResult {
  ok: boolean;
  status: number;
  error?: string;
}

/**
 * 驗證 PUT /days/:num 的 request body。
 * 回傳 { ok: true } 表示驗證通過；否則回傳 { ok: false, status, error }。
 */
export function validateDayBody(body: DayBody): ValidationResult {
  // Required field validation
  const missing: string[] = [];
  if (!body.date) missing.push('date');
  if (!body.dayOfWeek) missing.push('dayOfWeek');
  if (!body.label) missing.push('label');
  if (missing.length > 0) {
    return { ok: false, status: 400, error: `必填欄位缺失: ${missing.join(', ')}` };
  }

  // date format validation (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date!)) {
    return { ok: false, status: 400, error: 'date 格式必須為 YYYY-MM-DD' };
  }

  // label length validation (≤ 8 characters)
  if (body.label!.length > 8) {
    return { ok: false, status: 400, error: 'label 不得超過 8 字' };
  }

  return { ok: true, status: 200 };
}

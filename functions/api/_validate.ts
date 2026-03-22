/**
 * _validate.ts — server-side 必填驗證邏輯
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

export interface EntryBody {
  title?: string | null;
  [key: string]: unknown;
}

/**
 * 驗證 PATCH /entries/:eid 的 request body。
 * 回傳 { ok: true } 表示驗證通過；否則回傳 { ok: false, status, error }。
 */
export function validateEntryBody(body: EntryBody): ValidationResult {
  if (!body.title) {
    return { ok: false, status: 400, error: '必填欄位缺失: title' };
  }
  return { ok: true, status: 200 };
}

/**
 * 啟發式偵測疑似亂碼字串（常見於 CP950/Big5 → UTF-8 誤轉）。
 * 回傳 true 表示偵測到亂碼特徵。
 */
export function detectGarbledText(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  // U+FFFD replacement character
  if (text.includes('\uFFFD')) return true;
  // 連續 3+ 個 Latin Extended bytes（常見於 Big5→UTF-8 誤轉）
  if (/[\u0080-\u00FF]{3,}/.test(text)) return true;
  // C1 控制字元（除了常見的 \t \n \r）
  if (/[\x80-\x9F]/.test(text)) return true;
  return false;
}

export interface RestaurantBody {
  name?: string | null;
  [key: string]: unknown;
}

/**
 * 驗證 POST /restaurants 和 PATCH /restaurants/:rid 的 request body。
 * 回傳 { ok: true } 表示驗證通過；否則回傳 { ok: false, status, error }。
 */
export function validateRestaurantBody(body: RestaurantBody): ValidationResult {
  if (!body.name) {
    return { ok: false, status: 400, error: '必填欄位缺失: name' };
  }
  return { ok: true, status: 200 };
}

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

  // 規則一：U+FFFD（Unicode Replacement Character）
  // 瀏覽器/平台在無法解析某 byte 時插入此字元，出現即代表原始 bytes 非合法 UTF-8。
  if (text.includes('\uFFFD')) return true;

  // 規則二：連續 3+ 個 Latin Extended（U+0080–U+00FF）
  // CP950/Big5 多位元組字元誤當 ISO-8859-1 解碼後，常產生一串 Latin Extended 字元；
  // 合法中文 UTF-8 不會產生此特徵，故 3 個以上視為亂碼。
  if (/[\u0080-\u00FF]{3,}/.test(text)) return true;

  // 規則三：C1 控制字元（U+0080–U+009F）
  // 這段範圍在 UTF-8 正常文字內容中不應出現；
  // 若有則表示原始資料含有 Windows-1252 或其他單位元組編碼的殘留。
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

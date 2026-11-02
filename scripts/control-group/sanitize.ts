/**
 * 對照組消毒：把「只讀自白名單表」的列，轉成可直接載入本機 D1 的 INSERT。
 * 純函式：同樣的輸入產生同樣的輸出（假 email 的流水號依 users 的 id 排序決定）。
 */
import { COPY_TABLES, POLICY, type ColumnRule, type Row } from './policy.ts';
import { EMAIL_RE, FAKE_EMAIL_DOMAIN, isFakeEmail, redactTokens } from './scan.ts';

const PLACEHOLDER = '[truncated]';

class Sanitizer {
  private users = new Map<string, number>(); // 小寫 email → 使用者序號
  private externals = new Map<string, number>(); // 其他 email → 序號
  private contacts = 0;

  /** 載入使用者，決定 userN 的編號（依 id 排序，確定性）。 */
  seedUsers(rows: Row[]): void {
    const sorted = [...rows].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    for (const r of sorted) {
      if (typeof r.email === 'string' && r.email) this.userIndex(r.email);
    }
  }

  userIndex(email: string): number {
    const key = email.toLowerCase();
    if (!this.users.has(key)) this.users.set(key, this.users.size + 1);
    return this.users.get(key)!;
  }

  fakeEmail(email: string): string {
    const key = email.toLowerCase();
    if (isFakeEmail(key)) return key;
    if (this.users.has(key)) return `user${this.users.get(key)}@${FAKE_EMAIL_DOMAIN}`;
    if (!this.externals.has(key)) this.externals.set(key, this.externals.size + 1);
    return `ext${this.externals.get(key)}@${FAKE_EMAIL_DOMAIN}`;
  }

  /** 自由文字：email → 假位址，token 樣式 → [token]。 */
  scrubText(text: string): string {
    return redactTokens(text.replace(EMAIL_RE, (m) => this.fakeEmail(m)));
  }

  private rule(rule: ColumnRule, value: unknown, row: Row): unknown {
    switch (rule) {
      case 'null':
        return null;
      case 'mask':
        return value == null ? null : '[masked]';
      case 'placeholder':
        return value == null ? null : PLACEHOLDER;
      case 'email':
        return typeof value === 'string' && value ? (EMAIL_RE.test(value) ? this.fakeEmail(value) : value) : value;
      case 'user-name':
        return typeof row.email === 'string' && row.email ? `User ${this.userIndex(row.email)}` : null;
      case 'contact-name':
        return value == null ? null : `Contact ${++this.contacts}`;
      case 'redact-path': {
        if (typeof value !== 'string') return value;
        const parts = value.split('?')[0]!.split('/');
        return parts.length > 3 ? `${parts.slice(0, 3).join('/')}/…` : parts.join('/');
      }
    }
  }

  row(table: string, input: Row): Row {
    const policy = POLICY[table];
    if (!policy || policy.mode !== 'copy') throw new Error(`${table} 不在複製清單內`);
    const out: Row = {};
    for (const [col, value] of Object.entries(input)) {
      const rule = policy.columns?.[col];
      let v = rule ? this.rule(rule, value, input) : value;
      // 所有字串欄位（含 email 類的非 email 值）最後都再過一次洗滌
      if (typeof v === 'string' && rule !== 'placeholder' && rule !== 'mask') v = this.scrubText(v);
      out[col] = v;
      // EMAIL_RE 有 g 旗標，test() 會留下 lastIndex，這裡手動重設
      EMAIL_RE.lastIndex = 0;
    }
    return out;
  }
}

function literal(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'bigint') return String(v);
  if (typeof v === 'boolean') return v ? '1' : '0';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  // 換行用 char() 串接，讓每個 INSERT 保持單行
  return s
    .split(/(\r\n|\n|\r)/)
    .filter((p) => p !== '')
    .map((p) => (p === '\n' ? 'char(10)' : p === '\r' ? 'char(13)' : p === '\r\n' ? 'char(13) || char(10)' : `'${p.replace(/'/g, "''")}'`))
    .join(' || ') || "''";
}

function insert(table: string, row: Row): string {
  const cols = Object.keys(row);
  return `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols.map((c) => literal(row[c])).join(', ')});`;
}

/** 外鍵：table.from 參照 parent.to（由 PRAGMA foreign_key_list 取得）。 */
export interface ForeignKey {
  table: string;
  from: string;
  parent: string;
  to: string;
}

/** 依外鍵修剪孤兒列：父列沒保留，子列就丟（連鎖，直到不再變動）。外鍵欄位為 NULL 的列保留。 */
function pruneOrphans(kept: Record<string, Row[]>, fks: ForeignKey[]): void {
  let changed = true;
  while (changed) {
    changed = false;
    for (const fk of fks) {
      const children = kept[fk.table];
      const parents = kept[fk.parent];
      if (!children || !parents) continue;
      const ok = new Set(parents.map((r) => String(r[fk.to])));
      const next = children.filter((r) => r[fk.from] == null || ok.has(String(r[fk.from])));
      if (next.length !== children.length) {
        kept[fk.table] = next;
        changed = true;
      }
    }
  }
}

export interface SanitizeResult {
  sql: string;
  counts: Record<string, number>;
}

/**
 * @param rowsByTable 來源列。只會讀 COPY_TABLES；其他表即使被傳進來也會被忽略。
 * @param order       插入順序（父表在前）；預設照 COPY_TABLES，並讓 users 排最前。
 */
export function sanitize(rowsByTable: Record<string, Row[]>, order?: string[], foreignKeys: ForeignKey[] = []): SanitizeResult {
  const s = new Sanitizer();
  s.seedUsers(rowsByTable.users ?? []);
  const tables = (order ?? ['users', ...COPY_TABLES.filter((t) => t !== 'users')]).filter((t) => COPY_TABLES.includes(t));
  const kept: Record<string, Row[]> = {};
  for (const table of tables) {
    const policy = POLICY[table]!;
    if (policy.mode !== 'copy') continue;
    let rows = rowsByTable[table] ?? [];
    if (policy.keepNewest) {
      const { by, count } = policy.keepNewest;
      rows = [...rows].sort((a, b) => Number(b[by]) - Number(a[by])).slice(0, count).reverse();
    }
    kept[table] = rows;
  }
  pruneOrphans(kept, foreignKeys);

  const lines: string[] = [];
  const counts: Record<string, number> = {};
  for (const table of tables) {
    const rows = kept[table];
    if (!rows) continue;
    counts[table] = rows.length;
    for (const r of rows) lines.push(insert(table, s.row(table, r)));
  }
  return { sql: `${lines.join('\n')}\n`, counts };
}

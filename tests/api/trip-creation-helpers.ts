/** S1 行程建立測試：故障只注入外部 D1 statement，其餘建立與補償照常執行真 D1。 */
export function withTripCreationFaults(db: D1Database, rules: { sql: RegExp; occurrence?: number; table: string }[], beforeFailure?: () => Promise<void>): D1Database {
  const seen = rules.map(() => 0);
  const failures = new WeakSet<D1PreparedStatement>();
  return new Proxy(db, { get(target, property) {
    if (property === 'prepare') return (sql: string) => {
      const rule = rules.find((rule, i) => rule.sql.test(sql) && ++seen[i]! === (rule.occurrence ?? 1));
      if (!rule) return target.prepare(sql);
      const failure = target.prepare(`SELECT * FROM ${rule.table}`);
      failures.add(failure);
      return new Proxy(failure, { get(stmt, member) {
        if (member === 'bind') return () => failure;
        const value = Reflect.get(stmt, member);
        return typeof value === 'function' ? value.bind(stmt) : value;
      } });
    };
    if (property === 'batch') return async (statements: D1PreparedStatement[]) => {
      if (statements.some(stmt => failures.has(stmt))) await beforeFailure?.();
      return target.batch(statements);
    };
    const value = Reflect.get(target, property);
    return typeof value === 'function' ? value.bind(target) : value;
  } });
}

export async function tripStructureCounts(db: D1Database) {
  // audit 保留既有政策；rate limit 計的是嘗試，失敗也不扣回。
  const tables = ['trips', 'trip_permissions', 'trip_destinations', 'trip_days', 'trip_entries', 'trip_entry_pois',
    'trip_segments', 'pois', 'trip_flights', 'trip_lodgings', 'trip_reservations', 'trip_pretrip_notes', 'trip_emergency_contacts'];
  return (await db.prepare(`SELECT ${tables.map(table => `(SELECT COUNT(*) FROM ${table}) AS ${table}`).join(', ')}`)
    .all<Record<string, unknown>>()).results;
}

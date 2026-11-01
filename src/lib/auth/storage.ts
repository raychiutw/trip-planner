/**
 * 持久儲存介面：只放 refresh token 與 DPoP 金鑰對。
 * access token **刻意不在這個介面裡** —— 它只活在 client 的記憶體（見 client.ts），
 * 所以結構上就沒有寫進任何持久儲存的路徑。
 */

export interface AuthSession {
  refreshToken: string;
  keyPair: CryptoKeyPair;
}

export interface AuthStorage {
  getRefreshToken(): Promise<string | null>;
  getKeyPair(): Promise<CryptoKeyPair | null>;
  saveSession(session: AuthSession): Promise<void>;
  /** refresh 輪替後只換 refresh token。 */
  saveRefreshToken(refreshToken: string): Promise<void>;
  clear(): Promise<void>;
}

/** 記憶體實作（測試用、也可當 IndexedDB 不可用時的退路 —— 此時重新整理即登出）。 */
export function createMemoryAuthStorage(): AuthStorage & { dumpValues(): string[] } {
  let refreshToken: string | null = null;
  let keyPair: CryptoKeyPair | null = null;
  return {
    async getRefreshToken() { return refreshToken; },
    async getKeyPair() { return keyPair; },
    async saveSession(s) { refreshToken = s.refreshToken; keyPair = s.keyPair; },
    async saveRefreshToken(t) { refreshToken = t; },
    async clear() { refreshToken = null; keyPair = null; },
    /** 測試用：目前存著的所有字串值（金鑰以標記代替）。 */
    dumpValues() { return [refreshToken ?? '', keyPair ? '[CryptoKeyPair]' : '']; },
  };
}

const DB_NAME = 'tripline-auth';
const STORE = 'kv';
const KEY_REFRESH = 'refreshToken';
const KEY_PAIR = 'keyPair';

/**
 * IndexedDB 轉接層。CryptoKey 可結構化複製，所以不可匯出的私鑰可以直接存進去。
 * 延遲開啟：建立物件時不碰 indexedDB（flag 關閉時整條路徑都不會被呼叫到）。
 * `indexedDB` 可注入，jsdom 沒有 IndexedDB 時測試以 fake-indexeddb 替代。
 */
export function createIdbAuthStorage(opts: { indexedDB?: IDBFactory } = {}): AuthStorage {
  let dbPromise: Promise<IDBDatabase> | null = null;

  const open = (): Promise<IDBDatabase> => {
    dbPromise ??= new Promise((resolve, reject) => {
      const factory = opts.indexedDB ?? globalThis.indexedDB;
      if (!factory) { reject(new Error('IndexedDB 不可用')); return; }
      const req = factory.open(DB_NAME, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  };

  const run = async <T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> => {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  };

  return {
    async getRefreshToken() {
      const v = await run('readonly', (s) => s.get(KEY_REFRESH));
      return typeof v === 'string' ? v : null;
    },
    async getKeyPair() {
      const v = await run('readonly', (s) => s.get(KEY_PAIR)) as CryptoKeyPair | undefined;
      return v?.privateKey && v.publicKey ? v : null;
    },
    async saveSession({ refreshToken, keyPair }) {
      // 同一個 transaction：不會出現只寫一半（有 refresh 沒金鑰）的狀態
      await run('readwrite', (s) => { s.put(refreshToken, KEY_REFRESH); s.put(keyPair, KEY_PAIR); });
    },
    async saveRefreshToken(refreshToken) {
      await run('readwrite', (s) => { s.put(refreshToken, KEY_REFRESH); });
    },
    async clear() {
      await run('readwrite', (s) => { s.clear(); });
    },
  };
}

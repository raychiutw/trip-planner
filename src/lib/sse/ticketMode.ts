/**
 * `VITE_NEW_API_AUTH=1` 時 useRequestSSE 才會（動態）載入的模組：把 typed client、auth 與 ticket 連線接在一起。
 * 旗標關閉時這個模組（連同 typed client 的執行期程式）完全不會被載入。
 */
import { createApiWithAuth } from '../api/withAuth';
import { getNewApiAuth } from '../auth';
import { openTicketStream } from './ticketStream';

export { openTicketStream };

export function createTicketMode() {
  const auth = getNewApiAuth();
  if (!auth) throw new Error('新 api 認證未啟用（VITE_NEW_API_AUTH）');
  const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';
  return { api: createApiWithAuth(auth), auth, apiBase };
}

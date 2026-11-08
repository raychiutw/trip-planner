/**
 * useRequestSSE 才會（動態）載入的模組：把 typed client、auth 與 ticket 連線接在一起。
 */
import { createApiWithAuth } from '../api/withAuth';
import { getNewApiAuth } from '../auth';
import { openTicketStream } from './ticketStream';

export { openTicketStream };

export function createTicketMode() {
  const auth = getNewApiAuth();
  const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';
  return { api: createApiWithAuth(auth), auth, apiBase };
}

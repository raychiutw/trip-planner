/**
 * GET /api/requests/:id/events — Server-Sent Events for request status updates
 *
 * - 每 10 秒 poll D1 狀態
 * - 每 25 秒 keepalive ping
 * - status=completed/failed 時關閉
 * - 最長 10 分鐘
 */

import { hasPermission } from '../../_auth';
import { AppError } from '../../_errors';
import { getAuth } from '../../_utils';
import type { Env } from '../../_types';

const POLL_INTERVAL_MS = 10_000;
const KEEPALIVE_INTERVAL_MS = 25_000;
const MAX_DURATION_MS = 10 * 60 * 1000;

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');
  const id = params.id as string;

  // 驗證使用者有權限看這個 request 所屬的 trip
  const req = await env.DB.prepare('SELECT trip_id FROM trip_requests WHERE id = ?').bind(id).first() as { trip_id: string } | null;
  if (!req) throw new AppError('DATA_NOT_FOUND');
  if (!await hasPermission(env.DB, auth.email, req.trip_id, auth.isAdmin)) {
    throw new AppError('PERM_DENIED');
  }

  let lastStatus = '';
  let lastProcessedBy = '';
  const startTime = Date.now();
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let keepaliveTimer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const send = (data: string) => {
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };
      const ping = () => {
        controller.enqueue(encoder.encode(': ping\n\n'));
      };

      const poll = async (): Promise<boolean> => {
        try {
          const row = await env.DB.prepare(
            'SELECT status, processed_by, updated_at FROM trip_requests WHERE id = ?'
          ).bind(id).first() as { status: string; processed_by: string | null; updated_at: string | null } | null;

          if (!row) {
            send(JSON.stringify({ error: 'not_found' }));
            return true; // close
          }

          const currentStatus = row.status;
          const currentProcessedBy = row.processed_by || '';

          if (currentStatus !== lastStatus || currentProcessedBy !== lastProcessedBy) {
            lastStatus = currentStatus;
            lastProcessedBy = currentProcessedBy;
            send(JSON.stringify({
              status: row.status,
              processedBy: row.processed_by,
              updatedAt: row.updated_at,
            }));
          }

          return currentStatus === 'completed' || currentStatus === 'failed';
        } catch {
          return false; // keep going on transient errors
        }
      };

      // Initial poll
      const done = await poll();
      if (done) {
        controller.close();
        return;
      }

      // Poll + keepalive loop
      pollTimer = setInterval(async () => {
        if (Date.now() - startTime > MAX_DURATION_MS) {
          clearInterval(pollTimer);
          clearInterval(keepaliveTimer);
          try { controller.close(); } catch {}
          return;
        }
        try {
          const shouldClose = await poll();
          if (shouldClose) {
            clearInterval(pollTimer);
            clearInterval(keepaliveTimer);
            try { controller.close(); } catch {}
          }
        } catch {
          // transient error, keep going
        }
      }, POLL_INTERVAL_MS);

      keepaliveTimer = setInterval(() => {
        try { ping(); } catch {}
      }, KEEPALIVE_INTERVAL_MS);
    },
    cancel() {
      if (pollTimer) clearInterval(pollTimer);
      if (keepaliveTimer) clearInterval(keepaliveTimer);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
};

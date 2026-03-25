/**
 * Vite dev server mock API plugin.
 * 用法：MOCK_API=1 npx vite dev
 * 攔截 /api/* 請求，返回 mock 資料供本機測試。
 */
import type { Plugin } from 'vite';

const MOCK_MY_TRIPS = [{ tripId: 'okinawa-trip-2026-Ray' }];

const MOCK_ALL_TRIPS = [
  { tripId: 'okinawa-trip-2026-Ray', name: 'Ray 的沖繩之旅', published: 1 },
];

const MOCK_REQUESTS = [
  {
    id: 1, trip_id: 'okinawa-trip-2026-Ray', mode: 'trip-edit',
    message: 'Day 3 午餐換成通堂拉麵', submitted_by: 'Ray',
    reply: '已更新 Day 3 午餐為**通堂拉麵**（小祿本店）。\n\n| 項目 | 內容 |\n|------|------|\n| 餐廳 | 通堂拉麵 |\n| 時間 | 12:00-13:00 |\n| 地點 | 那霸市金城 |',
    status: 'completed', created_at: '2026-03-25T10:00:00',
  },
  {
    id: 2, trip_id: 'okinawa-trip-2026-Ray', mode: 'trip-plan',
    message: '推薦 Day 5 下午的購物地點', submitted_by: null, reply: null,
    status: 'processing', created_at: '2026-03-25T12:00:00',
  },
  {
    id: 3, trip_id: 'okinawa-trip-2026-Ray', mode: 'trip-edit',
    message: 'Day 2 加一個美國村逛街', submitted_by: 'Lean',
    reply: null, status: 'open', created_at: '2026-03-26T08:00:00',
  },
];

const MOCK_PERMISSIONS = [
  { id: 1, email: 'lean.lean@gmail.com', trip_id: 'okinawa-trip-2026-Ray', role: 'admin' },
  { id: 2, email: 'ray@example.com', trip_id: 'okinawa-trip-2026-Ray', role: 'member' },
];

function json(data: unknown, status = 200) {
  return { status, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
}

export function mockApiPlugin(): Plugin {
  return {
    name: 'mock-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();

        const url = new URL(req.url, 'http://localhost');
        const path = url.pathname;

        let resp: { status: number; headers: Record<string, string>; body: string };

        if (path === '/api/my-trips') {
          resp = json(MOCK_MY_TRIPS);
        } else if (path === '/api/trips' && url.searchParams.get('all') === '1') {
          resp = json(MOCK_ALL_TRIPS);
        } else if (path === '/api/requests' && req.method === 'GET') {
          resp = json(MOCK_REQUESTS);
        } else if (path === '/api/requests' && req.method === 'POST') {
          const newReq = { id: Date.now(), trip_id: 'okinawa-trip-2026-Ray', mode: 'trip-edit', message: '(mock)', submitted_by: 'You', reply: null, status: 'open', created_at: new Date().toISOString() };
          resp = json(newReq, 201);
        } else if (path === '/api/permissions') {
          resp = json(MOCK_PERMISSIONS);
        } else if (path.startsWith('/api/trips/')) {
          resp = json({ tripId: 'okinawa-trip-2026-Ray', name: 'Ray 的沖繩之旅', title: '2026 沖繩五日自駕遊行程表', selfDrive: true });
        } else {
          resp = json({ error: 'mock: not found' }, 404);
        }

        res.writeHead(resp.status, resp.headers);
        res.end(resp.body);
      });
    },
  };
}

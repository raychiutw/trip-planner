import express from 'express';
import { validateWebhookSecret } from './lib/auth.js';
import { handleProcess } from './routes/process.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// Health check (no auth)
app.get('/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// Process webhook (auth required)
app.post('/process', validateWebhookSecret, handleProcess);

const server = app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Agent server listening on :${PORT}`);
});

// Graceful shutdown
let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[${new Date().toISOString()}] ${signal} received, shutting down...`);
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
  setTimeout(() => {
    console.log('Force shutdown after 30s');
    process.exit(1);
  }, 30000);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

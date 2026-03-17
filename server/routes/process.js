import { query } from '@anthropic-ai/claude-agent-sdk';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');

const API_BASE = 'https://trip-planner-dby.pages.dev';

function getServiceHeaders() {
  return {
    'Content-Type': 'application/json',
    'CF-Access-Client-Id': process.env.CF_ACCESS_CLIENT_ID || '',
    'CF-Access-Client-Secret': process.env.CF_ACCESS_CLIENT_SECRET || '',
  };
}

async function patchRequest(requestId, reply, processedBy = 'agent') {
  const res = await fetch(`${API_BASE}/api/requests/${requestId}`, {
    method: 'PATCH',
    headers: getServiceHeaders(),
    body: JSON.stringify({ reply, status: 'closed', processed_by: processedBy }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PATCH request #${requestId} failed: ${res.status} ${text}`);
  }
  return res.json();
}

// Simple queue to process one request at a time
let processing = false;
const queue = [];

async function processRequest(requestId) {
  console.log(`[${new Date().toISOString()}] Processing request #${requestId}...`);

  let agentResult = '';
  for await (const message of query({
    prompt: `處理旅伴請求 #${requestId}。步驟：
1. 用 curl 呼叫 GET ${API_BASE}/api/requests/${requestId}（帶 Service Token headers）讀取請求內容
2. 依內容判斷「修改」或「諮詢」
3. 修改類：GET 行程資料 → 用 PATCH/PUT API 修改行程資料
4. 諮詢類：不需修改行程
5. 【重要】不要自己 PATCH 回覆請求。你的最終輸出文字會被系統自動寫入為回覆。請在最後輸出給旅伴的回覆內容（繁體中文），不要包含任何 curl 指令或 JSON 格式。
注意：使用 Service Token headers CF-Access-Client-Id 和 CF-Access-Client-Secret（從環境變數取得）`,
    options: {
      cwd: PROJECT_ROOT,
      allowedTools: ['Bash', 'Read', 'Grep', 'Glob'],
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      maxTurns: 30,
      model: 'claude-sonnet-4-6',
      settingSources: ['project'],
    },
  })) {
    if ('result' in message) {
      agentResult = message.result || '';
      console.log(`[${new Date().toISOString()}] Agent finished request #${requestId}`);
    }
  }

  // Write reply via Node.js fetch (UTF-8 safe, bypasses Windows shell encoding issues)
  const reply = agentResult || '已處理完成。';
  await patchRequest(requestId, reply);
  console.log(`[${new Date().toISOString()}] Reply written for request #${requestId}`);
  return reply;
}

function processQueue() {
  if (processing || queue.length === 0) return;
  processing = true;
  const { requestId, res } = queue.shift();

  processRequest(requestId)
    .then(result => {
      res.json({ ok: true, result: typeof result === 'string' ? result.substring(0, 500) : 'done' });
    })
    .catch(err => {
      console.error(`Error processing #${requestId}:`, err.message);
      res.status(500).json({ error: err.message });
    })
    .finally(() => {
      processing = false;
      processQueue();
    });
}

export function handleProcess(req, res) {
  const { requestId } = req.body;
  if (!requestId) {
    return res.status(400).json({ error: 'Missing requestId' });
  }

  queue.push({ requestId, res });
  console.log(`[${new Date().toISOString()}] Queued request #${requestId} (queue: ${queue.length})`);
  processQueue();
}

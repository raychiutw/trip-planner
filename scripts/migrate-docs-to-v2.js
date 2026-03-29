/**
 * 遷移 trip_docs (JSON content) → trip_docs_v2 + trip_doc_entries (relational)
 * 用法: export $(grep CF_ACCESS .env.local | xargs) && node scripts/migrate-docs-to-v2.js
 */
const https = require('https');

const BASE = 'trip-planner-dby.pages.dev';
const HEADERS = {
  'CF-Access-Client-Id': process.env.CF_ACCESS_CLIENT_ID,
  'CF-Access-Client-Secret': process.env.CF_ACCESS_CLIENT_SECRET,
  'Content-Type': 'application/json',
  'Origin': 'https://trip-planner-dby.pages.dev',
};

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const req = https.request({
      hostname: BASE, path, method,
      headers: { ...HEADERS, 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch { resolve(b); } });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

/** Parse old JSON doc content → array of { section, title, content } */
function parseDoc(docType, raw) {
  let parsed = raw;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch { return { title: '', entries: [] }; }
  }

  const docTitle = parsed.title || '';
  const inner = parsed.content || parsed;
  const entries = [];

  if (docType === 'flights') {
    // segments → entries
    if (inner.segments) {
      for (const seg of inner.segments) {
        entries.push({
          section: '',
          title: seg.label || '',
          content: [seg.route, seg.time].filter(Boolean).join('\n'),
        });
      }
    }
    // airline → entry
    if (inner.airline) {
      entries.push({
        section: '',
        title: inner.airline.name || '',
        content: inner.airline.note || '',
      });
    }
  } else if (docType === 'checklist') {
    if (inner.cards) {
      for (const card of inner.cards) {
        const section = card.title || '';
        if (card.items) {
          for (const item of card.items) {
            entries.push({ section, title: typeof item === 'string' ? item : (item.text || ''), content: '' });
          }
        }
      }
    } else if (inner.items) {
      for (const item of inner.items) {
        entries.push({ section: '', title: typeof item === 'string' ? item : (item.text || ''), content: '' });
      }
    }
  } else if (docType === 'backup') {
    if (inner.cards) {
      for (const card of inner.cards) {
        const section = card.title || '';
        if (card.description) {
          entries.push({ section, title: '', content: card.description });
        }
        const items = card.weatherItems || card.items || [];
        for (const item of items) {
          entries.push({ section, title: typeof item === 'string' ? item : '', content: '' });
        }
      }
    }
  } else if (docType === 'suggestions') {
    if (inner.cards) {
      for (const card of inner.cards) {
        const section = card.title || '';
        const items = card.items || [];
        if (items.length > 0) {
          for (const item of items) {
            entries.push({ section, title: typeof item === 'string' ? item : '', content: '' });
          }
        } else if (card.description) {
          entries.push({ section, title: '', content: card.description });
        }
      }
    }
  } else if (docType === 'emergency') {
    if (inner.cards) {
      for (const card of inner.cards) {
        const section = card.title || '';
        if (card.contacts) {
          for (const c of card.contacts) {
            const phone = c.phone || '';
            const url = c.url || (phone ? `tel:${phone}` : '');
            const label = c.label || phone;
            entries.push({
              section,
              title: label,
              content: url ? `[${phone || label}](${url})` : '',
            });
          }
        }
      }
    } else if (inner.contacts) {
      for (const c of inner.contacts) {
        const phone = c.phone || c.number || '';
        entries.push({
          section: '',
          title: c.label || phone,
          content: phone ? `[${phone}](tel:${phone})` : '',
        });
      }
    }
  }

  return { title: docTitle, entries };
}

async function main() {
  const trips = await api('GET', '/api/trips?all=1');
  console.log(`Found ${trips.length} trips\n`);

  const DOC_TYPES = ['flights', 'checklist', 'backup', 'suggestions', 'emergency'];
  let totalDocs = 0;
  let totalEntries = 0;

  for (const trip of trips) {
    console.log(`=== ${trip.tripId} ===`);
    for (const dt of DOC_TYPES) {
      try {
        const doc = await api('GET', `/api/trips/${trip.tripId}/docs/${dt}`);
        if (!doc.content) {
          console.log(`  ${dt}: EMPTY → skip`);
          continue;
        }

        const { title, entries } = parseDoc(dt, doc.content);

        // PUT to new v2 endpoint
        const result = await api('PUT', `/api/trips/${trip.tripId}/docs-v2/${dt}`, {
          title,
          entries: entries.map((e, i) => ({ ...e, sort_order: i })),
        });

        console.log(`  ${dt}: ${entries.length} entries → ${result.ok ? 'OK' : JSON.stringify(result).slice(0, 80)}`);
        totalDocs++;
        totalEntries += entries.length;
      } catch (err) {
        console.log(`  ${dt}: ERROR ${err.message?.slice(0, 50)}`);
      }
    }
  }

  console.log(`\nDone: ${totalDocs} docs, ${totalEntries} entries migrated`);
}

main().catch(console.error);

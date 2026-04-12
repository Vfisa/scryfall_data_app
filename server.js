import express from 'express';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const KBC_TOKEN = process.env.KBC_TOKEN || '';
const KBC_URL = (process.env.KBC_URL || 'https://connection.eu-central-1.keboola.com').replace(/\/+$/, '');

// Table IDs in Keboola Storage
const TABLES = {
  cards: 'out.c-scryfall.cards',
  snapshots: 'out.c-scryfall.cards_price_snapshot',
};

// In-memory cache
const cache = {
  cards: { data: null, fetchedAt: 0 },
  snapshots: { data: null, fetchedAt: 0 },
};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

app.use(express.json());

// --- API: fetch table data from Keboola Storage ---

async function fetchTableCSV(tableId) {
  // Use data-preview with a high limit for small tables (<10k rows)
  const url = `${KBC_URL}/v2/storage/tables/${encodeURIComponent(tableId)}/data-preview?limit=10000&format=rfc`;

  console.log(`Fetching table ${tableId} from ${KBC_URL}...`);

  const response = await fetch(url, {
    headers: {
      'X-StorageApi-Token': KBC_TOKEN,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`Keboola API error (${response.status}): ${body}`);
    throw new Error(`Keboola API returned ${response.status}: ${body}`);
  }

  const csvText = await response.text();
  console.log(`Fetched ${tableId}: ${csvText.length} bytes`);
  return csvText;
}

async function getCachedTable(key) {
  const entry = cache[key];
  const now = Date.now();

  if (entry.data && (now - entry.fetchedAt) < CACHE_TTL) {
    return entry.data;
  }

  const tableId = TABLES[key];
  const data = await fetchTableCSV(tableId);
  entry.data = data;
  entry.fetchedAt = now;
  return data;
}

app.get('/api/tables/cards', async (req, res) => {
  try {
    const csv = await getCachedTable('cards');
    res.set('Content-Type', 'text/csv');
    res.send(csv);
  } catch (err) {
    console.error('Error fetching cards:', err.message);
    res.status(502).json({ error: 'Failed to fetch cards from Keboola Storage', detail: err.message });
  }
});

app.get('/api/tables/snapshots', async (req, res) => {
  try {
    const csv = await getCachedTable('snapshots');
    res.set('Content-Type', 'text/csv');
    res.send(csv);
  } catch (err) {
    console.error('Error fetching snapshots:', err.message);
    res.status(502).json({ error: 'Failed to fetch snapshots from Keboola Storage', detail: err.message });
  }
});

// Force cache refresh
app.post('/api/refresh', async (req, res) => {
  try {
    cache.cards.fetchedAt = 0;
    cache.snapshots.fetchedAt = 0;
    await Promise.all([getCachedTable('cards'), getCachedTable('snapshots')]);
    res.json({ status: 'ok', message: 'Cache refreshed' });
  } catch (err) {
    res.status(502).json({ error: 'Failed to refresh', detail: err.message });
  }
});

// --- Static files ---

// Handle POST to / (Keboola platform sends POST on startup)
app.all('/', (req, res) => res.sendFile(join(__dirname, 'index.html')));
app.use(express.static(__dirname, { index: false }));

// --- Start ---

app.listen(PORT, '0.0.0.0', () => {
  console.log(`MTG Card Browser running on port ${PORT}`);
  console.log(`KBC_URL: ${KBC_URL}`);
  console.log(`KBC_TOKEN: ${KBC_TOKEN ? '***set***' : 'NOT SET'}`);

  // Pre-warm cache on startup
  Promise.all([getCachedTable('cards'), getCachedTable('snapshots')])
    .then(() => console.log('Cache pre-warmed successfully'))
    .catch(err => console.warn('Cache pre-warm failed (will retry on first request):', err.message));
});

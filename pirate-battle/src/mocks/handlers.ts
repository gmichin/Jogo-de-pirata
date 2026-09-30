import { http, HttpResponse } from 'msw';
import type { MatchRecord } from '../api/client';

const STORAGE_KEY = 'pirate-battle:matches';

function load(): MatchRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(records: MatchRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function paginate<T>(items: T[], page: number, pageSize: number) {
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    total: items.length,
  };
}

const seed: MatchRecord[] = [
  {
    id: 'seed-1',
    playerId: 'bot-1',
    playerName: 'Blackbeard',
    score: 42,
    durationSec: 90,
    endReason: 'time',
    config: { sessionTime: 90, spawnInterval: 3 },
    createdAt: new Date(Date.now() - 3600_000).toISOString(),
  },
  {
    id: 'seed-2',
    playerId: 'bot-2',
    playerName: 'Morgan',
    score: 28,
    durationSec: 70,
    endReason: 'death',
    config: { sessionTime: 90, spawnInterval: 3 },
    createdAt: new Date(Date.now() - 7200_000).toISOString(),
  },
];

function all(): MatchRecord[] {
  const stored = load();
  if (stored.length === 0) {
    save(seed);
    return seed;
  }
  return stored;
}

export const handlers = [
  http.get('/api/ranking', ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') || 1);
    const pageSize = Number(url.searchParams.get('pageSize') || 10);
    const sorted = [...all()].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.createdAt.localeCompare(b.createdAt);
    });
    return HttpResponse.json(paginate(sorted, page, pageSize));
  }),

  http.get('/api/history', ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') || 1);
    const pageSize = Number(url.searchParams.get('pageSize') || 10);
    const playerId = url.searchParams.get('playerId') || 'local';
    const filtered = all()
      .filter((r) => r.playerId === playerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return HttpResponse.json(paginate(filtered, page, pageSize));
  }),

  http.post('/api/history', async ({ request }) => {
    const body = (await request.json()) as Omit<MatchRecord, 'id' | 'createdAt'>;
    const records = all();
    
    const existing = records.find(
      (r) =>
        r.playerId === body.playerId &&
        r.score === body.score &&
        r.durationSec === body.durationSec &&
        r.endReason === body.endReason
    );
    if (existing) return HttpResponse.json(existing);
  
    const record: MatchRecord = {
      ...body,
      id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
    };
    records.push(record);
    save(records);
    return HttpResponse.json(record, { status: 201 });
  }),
];
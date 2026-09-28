import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  timeout: 8_000,
});

export interface MatchRecord {
  id: string;
  playerId: string;
  playerName: string;
  score: number;
  durationSec: number;
  endReason: 'time' | 'death';
  config: { sessionTime: number; spawnInterval: number };
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export async function fetchRanking(page = 1, pageSize = 10): Promise<Paginated<MatchRecord>> {
  const { data } = await api.get('/ranking', { params: { page, pageSize } });
  return data;
}

export async function fetchHistory(playerId: string, page = 1, pageSize = 10): Promise<Paginated<MatchRecord>> {
  const { data } = await api.get('/history', { params: { playerId, page, pageSize } });
  return data;
}

export async function submitMatch(record: Omit<MatchRecord, 'id' | 'createdAt'>): Promise<MatchRecord> {
  const { data } = await api.post('/history', record);
  return data;
}
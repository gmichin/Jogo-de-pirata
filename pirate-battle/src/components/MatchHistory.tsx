import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchHistory } from '../api/client';
import { Pagination } from './Ranking';

export default function MatchHistory() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['history', page],
    queryFn: () => fetchHistory('local', page),
  });

  if (isLoading) return <p>Loading history…</p>;
  if (isError) return <p className="error">Failed to load history.</p>;

  return (
    <div className="tab-panel">
      {isFetching && <p className="muted">Refreshing…</p>}
      <ul>
        {data?.items.map((r) => (
          <li key={r.id}>
            <b>{new Date(r.createdAt).toLocaleString()}</b> — {r.score} pts,{' '}
            {r.durationSec}s, {r.endReason}
          </li>
        ))}
      </ul>
      {data?.items.length === 0 && <p>No matches yet.</p>}
      <Pagination
        page={page}
        total={data?.total ?? 0}
        pageSize={data?.pageSize ?? 10}
        onChange={setPage}
      />
    </div>
  );
}
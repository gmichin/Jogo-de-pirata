import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchHistory } from '../api/client';
import Pagination from './Pagination';

const PAGE_SIZE = 5;

export default function MatchHistory() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['history', page],
    queryFn: () => fetchHistory('local', page, PAGE_SIZE),
  });

  if (isLoading) return <p>Loading history…</p>;
  if (isError) return <p className="error">Failed to load history.</p>;

  const items = data?.items ?? [];

  return (
    <div className="tab-panel">
      {isFetching && <p className="muted">Refreshing…</p>}

      {items.length === 0 ? (
        <p>No matches yet.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Points</th>
              <th>Duration</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.createdAt).toLocaleString()}</td>
                <td>{r.score}</td>
                <td>{r.durationSec}s</td>
                <td>{r.endReason === 'time' ? 'Time Up' : 'Defeated'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Pagination
        page={page}
        total={data?.total ?? 0}
        pageSize={data?.pageSize ?? PAGE_SIZE}
        onChange={setPage}
      />
    </div>
  );
}
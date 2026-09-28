import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchRanking } from '../api/client';

export default function Ranking() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['ranking', page],
    queryFn: () => fetchRanking(page),
  });

  if (isLoading) return <p>Loading ranking…</p>;
  if (isError) return <p className="error">Failed to load ranking.</p>;

  return (
    <div className="tab-panel">
      {isFetching && <p className="muted">Refreshing…</p>}
      <ol>
        {data?.items.map((r) => (
          <li key={r.id}>
            <b>{r.playerName}</b> — {r.score} pts
          </li>
        ))}
      </ol>
      {data?.items.length === 0 && <p>No records yet.</p>}
      <Pagination
        page={page}
        total={data?.total ?? 0}
        pageSize={data?.pageSize ?? 10}
        onChange={setPage}
      />
    </div>
  );
}

interface PaginationProps {
  page: number;
  total: number;
  pageSize: number;
  onChange: (p: number) => void;
}

export function Pagination({ page, total, pageSize, onChange }: PaginationProps) {
  const max = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="pagination">
      <button onClick={() => onChange(page - 1)} disabled={page <= 1}>Prev</button>
      <span>{page} / {max}</span>
      <button onClick={() => onChange(page + 1)} disabled={page >= max}>Next</button>
    </div>
  );
}
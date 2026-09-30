import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchRanking } from '../api/client';
import Pagination from './Pagination';

const PAGE_SIZE = 5;

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function Ranking() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['ranking', page],
    queryFn: () => fetchRanking(page, PAGE_SIZE),
  });

  if (isLoading) return <p>Loading ranking…</p>;
  if (isError) return <p className="error">Failed to load ranking.</p>;

  const items = data?.items ?? [];

  return (
    <div className="tab-panel">
      {isFetching && <p className="muted">Refreshing…</p>}

      {items.length === 0 ? (
        <p>No records yet.</p>
      ) : (
        <table className="data-table ranking-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Captain</th>
              <th>Points</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r, i) => (
              <tr key={r.id}>
                <td>{(page - 1) * PAGE_SIZE + i + 1}</td>
                <td>{r.playerName}</td>
                <td>{r.score}</td>
                <td>{fmtDate(r.createdAt)}</td>
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
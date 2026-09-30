interface Props {
  page: number;
  total: number;
  pageSize: number;
  onChange: (p: number) => void;
}

export default function Pagination({ page, total, pageSize, onChange }: Props) {
  const max = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="img-pagination">
      <button
        type="button"
        className="page-btn"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
      >
        <img src="/assets/png/default/ui/controls/icon_turn_left.png" alt="" />
      </button>
      <span className="page-info">{page} / {max}</span>
      <button
        type="button"
        className="page-btn"
        onClick={() => onChange(page + 1)}
        disabled={page >= max}
        aria-label="Next page"
      >
        <img src="/assets/png/default/ui/controls/icon_turn_right.png" alt="" />
      </button>
    </div>
  );
}
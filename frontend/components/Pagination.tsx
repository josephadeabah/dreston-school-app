"use client";

export default function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
  itemLabel = "items",
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
}) {
  if (total === 0) return null;

  return (
    <div className="flex items-center justify-between flex-wrap gap-3 px-1 py-3 text-sm text-plum-800/60">
      <span>
        {total} {itemLabel} · Page {page} of {totalPages}
      </span>
      <div className="flex items-center gap-2">
        <button
          className="btn-secondary text-xs px-3 py-1.5"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          ← Previous
        </button>
        <button
          className="btn-secondary text-xs px-3 py-1.5"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next →
        </button>
      </div>
    </div>
  );
}

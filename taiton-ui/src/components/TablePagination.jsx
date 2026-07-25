import React from 'react';

export function TablePagination({
  page,
  onChange,
  total,
  pageSize = 10,
  labelSingle = 'item',
  labelPlural = 'items',
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  
  // Calculate range display
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(total, page * pageSize);

  // Generate page numbers to show
  const pageNums = [];
  const maxPagesToShow = 5;
  let startPage = Math.max(1, page - 2);
  let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
  
  if (endPage - startPage + 1 < maxPagesToShow) {
    startPage = Math.max(1, endPage - maxPagesToShow + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pageNums.push(i);
  }

  return (
    <footer className="cp-accounts-footer" style={{ marginTop: '20px', borderTop: '1px solid var(--cp-border)', paddingTop: '16px' }}>
      <span>
        Showing {rangeStart}-{rangeEnd} of {total} {total === 1 ? labelSingle : labelPlural}
      </span>
      <nav className="cp-accounts-pagination" aria-label="Pagination">
        <button
          type="button"
          className="cp-accounts-page-btn"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          &lt; Previous
        </button>
        
        {pageNums.map((n) => (
          <button
            key={n}
            type="button"
            className={`cp-accounts-page-btn${n === page ? ' cp-accounts-page-btn--active' : ''}`}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        ))}
        
        <button
          type="button"
          className="cp-accounts-page-btn"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          Next &gt;
        </button>
      </nav>
    </footer>
  );
}

export function PageSpinner() {
  return (
    <div className="cp-page-loading" role="status" aria-label="Loading">
      <div className="cp-page-loading-spinner" />
      <span className="cp-page-loading-text">Loading…</span>
    </div>
  );
}

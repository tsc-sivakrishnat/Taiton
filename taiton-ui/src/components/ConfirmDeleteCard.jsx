/**
 * Inline confirmation card (replaces window.confirm popups).
 */
export function ConfirmDeleteCard({
  title = 'Are you sure you want to delete?',
  message,
  confirmLabel = 'Delete',
  busy = false,
  onConfirm,
  onCancel,
}) {
  return (
    <div className="cp-confirm-delete-root">
      <div className="cp-confirm-delete-backdrop" onClick={busy ? undefined : onCancel} />
      <div className="cp-confirm-delete" role="alertdialog" aria-labelledby="cp-confirm-delete-title">
        <button
          type="button"
          className="cp-confirm-delete__close"
          onClick={onCancel}
          disabled={busy}
          aria-label="Close"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M18 6L6 18M6 6l12 12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: '#fee2e2',
            color: '#dc2626',
            flexShrink: 0
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0, paddingTop: '2px' }}>
            <h3 id="cp-confirm-delete-title" className="cp-confirm-delete__title" style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: 700, color: 'var(--cp-text-title, #0f172a)' }}>
              {title}
            </h3>
            {message ? <p className="cp-confirm-delete__message" style={{ margin: 0, fontSize: '14px', color: 'var(--cp-text-muted, #475569)', lineHeight: 1.5 }}>{message}</p> : null}
          </div>
        </div>

        <div className="cp-confirm-delete__actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button type="button" className="cp-btn cp-btn-secondary" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="cp-btn cp-btn-danger" disabled={busy} onClick={onConfirm}>
            {busy ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

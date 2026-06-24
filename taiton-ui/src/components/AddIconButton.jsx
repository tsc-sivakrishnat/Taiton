/** Primary action with + icon; label expands on hover (matches org tile actions). */
export function AddIconButton({
  label,
  busyLabel,
  busy = false,
  disabled = false,
  type = 'submit',
  onClick,
  variant = 'primary',
}) {
  const text = busy && busyLabel ? busyLabel : label;
  return (
    <button
      type={type}
      className={`cp-add-icon-btn cp-add-icon-btn--${variant}`}
      disabled={disabled || busy}
      onClick={onClick}
      title={text}
      aria-label={text}
    >
      <span className="cp-add-icon-btn__icon" aria-hidden>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
      <span className="cp-add-icon-btn__label">{text}</span>
    </button>
  );
}

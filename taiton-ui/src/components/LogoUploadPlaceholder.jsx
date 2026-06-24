import { resolveBrandingAssetUrl } from '../utils/brandingAssetValidation.js';

/**
 * Clickable logo placeholder with preview and hidden file input.
 */
export function LogoUploadPlaceholder({
  id,
  label,
  hint,
  aspect = 'wide',
  src,
  busy = false,
  onPick,
}) {
  const resolved = src ? resolveBrandingAssetUrl(src) : '';
  const aspectClass =
    aspect === 'square' ? 'cp-logo-upload--square' : 'cp-logo-upload--wide';

  return (
    <div className={`cp-logo-upload ${aspectClass}`}>
      <span className="cp-logo-upload__label">{label}</span>
      <label htmlFor={id} className="cp-logo-upload__zone" aria-busy={busy}>
        {resolved ? (
          <img src={resolved} alt="" className="cp-logo-upload__preview" />
        ) : (
          <span className="cp-logo-upload__placeholder">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 16V4m0 0L8 8m4-4 4 4M4 20h16"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Choose file</span>
          </span>
        )}
        <input
          id={id}
          type="file"
          className="cp-logo-upload__input"
          accept="image/png,image/webp"
          onChange={onPick}
          disabled={busy}
        />
      </label>
      {hint ? <span className="cp-field-hint">{hint}</span> : null}
    </div>
  );
}

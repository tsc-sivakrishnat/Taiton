import { FieldLabel } from './FieldLabel.jsx';
import { FieldError } from './FieldError.jsx';

/** 10-digit mobile input (India-style); strips non-digits. */
export function MobileField({
  value,
  onChange,
  id,
  label = 'Mobile',
  required = true,
  className = 'cp-input',
  error,
}) {
  function handleChange(e) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
    onChange(digits);
  }

  return (
    <label className="cp-field">
      <FieldLabel required={required} htmlFor={id}>
        {label}
      </FieldLabel>
      <input
        id={id}
        className={className}
        type="tel"
        inputMode="numeric"
        autoComplete="off"
        maxLength={10}
        pattern="[0-9]{10}"
        title="Enter exactly 10 digits"
        value={value}
        onChange={handleChange}
        required={required}
        placeholder="10 digit mobile"
        aria-invalid={error ? true : undefined}
      />
      <FieldError message={error} />
    </label>
  );
}

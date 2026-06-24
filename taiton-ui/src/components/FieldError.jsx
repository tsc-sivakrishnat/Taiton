/** Inline validation message below a field. */
export function FieldError({ message }) {
  if (!message) return null;
  return (
    <span className="cp-field-error" role="alert">
      {message}
    </span>
  );
}

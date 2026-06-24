/** Field label with optional required asterisk. */
export function FieldLabel({ children, required, htmlFor }) {
  return (
    <span className="cp-field-label-text">
      {htmlFor ? <label htmlFor={htmlFor}>{children}</label> : children}
      {required ? <span className="cp-req" aria-hidden="true"> *</span> : null}
    </span>
  );
}

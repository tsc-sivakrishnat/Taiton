/** Checkbox list for assigning nav visibility to roles (rolesCsv). */
export function RoleMultiSelect({ roles, selectedCodes, onChange, label = 'Roles that can see this item' }) {
  const set = new Set(selectedCodes);

  function toggle(code) {
    const next = new Set(set);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    onChange([...next]);
  }

  if (!roles?.length) {
    return <p className="cp-muted">No roles available. Add roles under Onboarding Roles first.</p>;
  }

  return (
    <fieldset className="cp-role-multi">
      <legend className="cp-field-label">{label}</legend>
      <div className="cp-role-multi-grid">
        {roles.map((r) => (
          <label key={r.code} className="cp-role-multi-item">
            <input type="checkbox" checked={set.has(r.code)} onChange={() => toggle(r.code)} />
            <span>
              {r.name} <span className="cp-muted">({r.code})</span>
            </span>
          </label>
        ))}
      </div>
      <p className="cp-muted cp-role-multi-hint">
        Leave all unchecked to show this item to every role in the organization.
      </p>
    </fieldset>
  );
}

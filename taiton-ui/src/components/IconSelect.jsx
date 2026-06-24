import { SidebarNavIcon } from './SidebarNavIcon.jsx';
import { FieldLabel } from './FieldLabel.jsx';

export function IconSelect({ icons, value, onChange, label = 'Icon', required = true }) {
  return (
    <label className="cp-field">
      <FieldLabel required={required}>{label}</FieldLabel>
      <div className="cp-icon-select-row">
        <select className="cp-input" value={value} onChange={(e) => onChange(e.target.value)} required={required}>
          {(icons ?? []).map((ic) => (
            <option key={ic.code} value={ic.code}>
              {ic.label}
            </option>
          ))}
        </select>
        <span className="cp-icon-select-preview" aria-hidden>
          <SidebarNavIcon name={value} />
        </span>
      </div>
    </label>
  );
}

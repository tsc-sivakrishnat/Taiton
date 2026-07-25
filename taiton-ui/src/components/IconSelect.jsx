import { SidebarNavIcon } from './SidebarNavIcon.jsx';
import { FieldLabel } from './FieldLabel.jsx';
import { SearchableSelect } from './SearchableSelect.jsx';

export function IconSelect({ icons, value, onChange, label = 'Icon', required = true, className = 'cp-field' }) {
  const iconOptions = (icons ?? []).map((ic) => ({
    value: ic.code,
    label: ic.label,
  }));

  return (
    <label className={className}>
      <FieldLabel required={required}>{label}</FieldLabel>
      <div className="cp-icon-select-row" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <SearchableSelect
            options={iconOptions}
            value={value}
            onChange={onChange}
            placeholder="-- Search & Select Icon --"
          />
        </div>
        <span className="cp-icon-select-preview" aria-hidden style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', background: 'var(--cp-bg, #eef2f6)', borderRadius: '8px', border: '1px solid var(--cp-border)' }}>
          <SidebarNavIcon name={value} />
        </span>
      </div>
    </label>
  );
}

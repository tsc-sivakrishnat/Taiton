import { useEffect, useMemo, useRef, useState } from 'react';
import { FieldLabel } from './FieldLabel.jsx';
import { ComboboxPanel } from './ComboboxPanel.jsx';
import { formatRoleName } from '../utils/displayLabels.js';

function Chevron({ open }) {
  return (
    <svg
      className={`cp-combobox-chevron${open ? ' cp-combobox-chevron--open' : ''}`}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Multi-select roles via combobox; selected roles shown as chips. */
export function RoleMultiSelectDropdown({
  roles,
  selectedCodes,
  onChange,
  label = 'Roles that can see this item',
  action,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const anchorRef = useRef(null);
  const panelRef = useRef(null);
  const searchRef = useRef(null);
  const set = new Set(selectedCodes);

  const filteredRoles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roles ?? [];
    return (roles ?? []).filter(
      (r) =>
        String(r.name ?? '').toLowerCase().includes(q) ||
        String(r.code ?? '').toLowerCase().includes(q),
    );
  }, [roles, search]);

  useEffect(() => {
    function onDocClick(e) {
      if (anchorRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (open) {
      setSearch('');
      const t = window.setTimeout(() => searchRef.current?.focus(), 50);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [open]);

  function toggle(code) {
    const next = new Set(set);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    onChange([...next]);
  }

  function remove(code) {
    onChange(selectedCodes.filter((c) => c !== code));
  }

  if (!roles?.length) {
    return <p className="cp-muted">No roles available. Add roles under Onboarding Roles first.</p>;
  }

  const selectedRoles = roles.filter((r) => set.has(r.code));
  const triggerLabel = selectedRoles.length
    ? selectedRoles.map((r) => formatRoleName(r.code, r.name)).join(', ')
    : 'Select who can see this (leave empty for everyone)';

  return (
    <div className="cp-combobox-field cp-role-multiselect">
      <FieldLabel>{label}</FieldLabel>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', width: '100%' }}>
        <div className="cp-combobox" ref={anchorRef} style={{ flex: 1, minWidth: 0 }}>
          <button
            type="button"
            className={`cp-combobox-trigger${open ? ' cp-combobox-trigger--open' : ''}`}
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            style={{ width: '100%' }}
          >
            <span className={selectedRoles.length ? 'cp-combobox-trigger-text' : 'cp-combobox-trigger-placeholder'}>
              {triggerLabel}
            </span>
            <Chevron open={open} />
          </button>

          <ComboboxPanel
            open={open}
            anchorRef={anchorRef}
            panelRef={panelRef}
            className="cp-combobox-panel cp-combobox-panel--portal"
          >
            <div className="cp-combobox-search-wrap">
              <input
                ref={searchRef}
                type="text"
                className="cp-combobox-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Type to search…"
                autoComplete="off"
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
            <ul className="cp-combobox-list cp-combobox-list--check">
              {filteredRoles.length === 0 ? (
                <li className="cp-combobox-empty">No roles match your search.</li>
              ) : (
                filteredRoles.map((r) => (
                  <li key={r.code}>
                    <label className="cp-combobox-check-row">
                      <input
                        type="checkbox"
                        className="cp-combobox-check"
                        checked={set.has(r.code)}
                        onChange={() => toggle(r.code)}
                      />
                      <span className="cp-combobox-check-label">{formatRoleName(r.code, r.name)}</span>
                    </label>
                  </li>
                ))
              )}
            </ul>
          </ComboboxPanel>
        </div>
        {action && <div className="cp-role-multiselect-action" style={{ flex: 'none' }}>{action}</div>}
      </div>

      {selectedRoles.length > 0 ? (
        <div className="cp-role-chips">
          {selectedRoles.map((r) => (
            <span key={r.code} className="cp-role-chip">
              {formatRoleName(r.code, r.name)}
              <button
                type="button"
                className="cp-role-chip-remove"
                onClick={() => remove(r.code)}
                aria-label={`Remove ${r.name}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="cp-muted cp-role-dropdown-hint">No one selected — everyone in this organization can see this item.</p>
      )}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { FieldLabel } from './FieldLabel.jsx';
import { FieldError } from './FieldError.jsx';
import { ComboboxPanel } from './ComboboxPanel.jsx';
import { formatOrganizationName } from '../utils/displayLabels.js';

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

export function SearchableOrgSelect({
  organizations,
  value,
  onChange,
  label = 'Organization',
  required = false,
  placeholder = 'Select organization…',
  disabled = false,
  error,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const anchorRef = useRef(null);
  const panelRef = useRef(null);
  const searchRef = useRef(null);

  const selected = useMemo(
    () => organizations.find((o) => String(o.id) === String(value)),
    [organizations, value],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return organizations;
    return organizations.filter(
      (o) =>
        String(o.name ?? '').toLowerCase().includes(q) ||
        String(o.code ?? '').toLowerCase().includes(q),
    );
  }, [organizations, search]);

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

  function pick(org) {
    onChange(String(org.id));
    setOpen(false);
    setSearch('');
  }

  function clear() {
    onChange('');
    setOpen(false);
    setSearch('');
  }

  const triggerText = selected ? formatOrganizationName(selected) : '';

  return (
    <div className="cp-field cp-combobox-field">
      <FieldLabel required={required}>{label}</FieldLabel>
      <div className="cp-combobox" ref={anchorRef}>
        <button
          type="button"
          className={`cp-combobox-trigger${open ? ' cp-combobox-trigger--open' : ''}`}
          onClick={() => !disabled && setOpen((v) => !v)}
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          <span className={triggerText ? 'cp-combobox-trigger-text' : 'cp-combobox-trigger-placeholder'}>
            {triggerText || placeholder}
          </span>
          <Chevron open={open} />
        </button>

        <ComboboxPanel
          open={open && !disabled}
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
          <ul className="cp-combobox-list" role="listbox">
            {value ? (
              <li>
                <button type="button" className="cp-combobox-option cp-combobox-option--clear" onClick={clear}>
                  Clear selection
                </button>
              </li>
            ) : null}
            {filtered.length === 0 ? (
              <li className="cp-combobox-empty">No organization matches.</li>
            ) : (
              filtered.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    className={`cp-combobox-option${String(o.id) === String(value) ? ' cp-combobox-option--active' : ''}`}
                    role="option"
                    aria-selected={String(o.id) === String(value)}
                    onClick={() => pick(o)}
                  >
                      <span className="cp-combobox-option-label">{formatOrganizationName(o)}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </ComboboxPanel>
      </div>
      {required ? (
        <input
          className="cp-combobox-validity"
          tabIndex={-1}
          aria-hidden
          value={value}
          onChange={() => {}}
          required
        />
      ) : null}
      <FieldError message={error} />
    </div>
  );
}

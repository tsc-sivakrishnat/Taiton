import React from 'react';

export function TableFilters({
  searchVal,
  onSearchChange,
  statusVal,
  onStatusChange,
  searchPlaceholder = "Search...",
  children,
  onReset
}) {
  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '12px',
      alignItems: 'center',
      marginBottom: '16px',
      padding: '12px 16px',
      background: 'var(--cp-bg, #f8fafc)',
      borderRadius: '8px',
      border: '1px solid var(--cp-border, #e2e8f0)',
    }}>
      <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
        <input
          type="text"
          className="cp-input"
          style={{ width: '100%', paddingLeft: '36px', height: '38px', minHeight: 'auto' }}
          placeholder={searchPlaceholder}
          value={searchVal}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--cp-muted, #64748b)' }}
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </div>

      <div style={{ minWidth: '120px' }}>
        <select
          className="cp-input"
          style={{ height: '38px', minHeight: 'auto', padding: '0 12px' }}
          value={statusVal}
          onChange={(e) => onStatusChange(e.target.value)}
        >
          <option value="">All Status</option>
          <option value="live">Live</option>
          <option value="draft">Draft</option>
          <option value="pending_approval">Pending Approval</option>
        </select>
      </div>

      {children}

      {onReset && (searchVal || statusVal) ? (
        <button
          type="button"
          className="cp-btn cp-btn-secondary"
          onClick={onReset}
          style={{ height: '38px', minHeight: 'auto', padding: '0 12px', fontSize: '12px' }}
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}

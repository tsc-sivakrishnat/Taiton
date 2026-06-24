import { useMemo, useState } from 'react';

const ACCENT_PALETTE = [
  '#2563eb',
  '#7c3aed',
  '#0d9488',
  '#db2777',
  '#ea580c',
  '#ca8a04',
  '#16a34a',
  '#4f46e5',
  '#0891b2',
  '#9333ea',
];

/**
 * Dashboard stat card (Sales Overview style). Each instance picks a random accent from the palette
 * unless `accentColor` is passed — use `accentColor` when you want a fixed brand stripe per widget.
 *
 * @param {object} props
 * @param {string} [props.accentColor] — optional CSS color for top bar
 * @param {string} props.title
 * @param {string} [props.subtitle]
 * @param {{ value: string, label: string }[]} [props.periodOptions]
 * @param {{ label: string, value: string, delta?: string | null, deltaTone?: 'up' | 'down' | 'neutral' }[]} props.rows
 */
export function SalesOverviewCard({
  accentColor,
  title = 'Sales Overview',
  subtitle = 'Track your sales performance',
  periodOptions = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
  ],
  rows = [],
}) {
  const accent = useMemo(
    () => accentColor ?? ACCENT_PALETTE[Math.floor(Math.random() * ACCENT_PALETTE.length)],
    [accentColor],
  );
  const [period, setPeriod] = useState(periodOptions[0]?.value ?? 'daily');

  return (
    <article className="cp-sales-card" style={{ '--sales-accent': accent }}>
      <header className="cp-sales-card-head">
        <div className="cp-sales-card-titles">
          <h2 className="cp-sales-card-title">{title}</h2>
          {subtitle ? <p className="cp-sales-card-sub">{subtitle}</p> : null}
        </div>
        <select
          className="cp-sales-card-select"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          aria-label="Period"
        >
          {periodOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </header>
      <div className="cp-sales-card-divider" aria-hidden />
      <ul className="cp-sales-card-body">
        {rows.map((row, i) => (
          <li key={i} className="cp-sales-card-row">
            <span className="cp-sales-card-label">{row.label}</span>
            <span className="cp-sales-card-value">{row.value}</span>
            {row.delta != null && row.delta !== '' ? (
              <span className={`cp-sales-card-delta cp-sales-card-delta--${row.deltaTone ?? 'up'}`}>
                {row.delta}
              </span>
            ) : (
              <span className="cp-sales-card-dash">—</span>
            )}
          </li>
        ))}
      </ul>
    </article>
  );
}

import { Link } from 'react-router-dom';
import { useAuth } from '../context/authContext.js';
import { SalesOverviewCard } from '../components/SalesOverviewCard.jsx';
import {
  useDashboardSummary,
  useNotifications,
  useHostingMetrics,
} from '../hooks/useEnterpriseQueries.js';
import { PageSpinner } from '../components/PageSpinner.jsx';

function HostingMetricsBar({ data, loading, error }) {
  if (loading && !data) {
    return (
      <div className="cp-metrics-bar" style={{ justifyContent: 'center', padding: '24px 0' }}>
        <span className="cp-muted">Loading hosting metrics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cp-metrics-bar" style={{ justifyContent: 'center', padding: '24px 0' }}>
        <span className="cp-muted" style={{ color: 'var(--cp-danger)' }}>{error}</span>
      </div>
    );
  }

  if (!data) return null;

  const metricsConfig = [
    { key: 'cpu', label: 'CPU Usage', formatVal: (v) => `${v}%` },
    { key: 'memory', label: 'Memory', formatVal: (v) => `${v} MB` },
    { key: 'io', label: 'Disk I/O', formatVal: (v) => `${v} KB/s` },
    { key: 'iops', label: 'IOPS', formatVal: (v) => String(v) },
    { key: 'ep', label: 'Entry Processes', formatVal: (v) => String(v) },
    { key: 'nproc', label: 'Processes', formatVal: (v) => String(v) },
  ];

  const getTrendInfo = (datapoints) => {
    if (!datapoints || datapoints.length < 2) {
      return { text: '0%', color: 'var(--cp-text-muted)' };
    }
    const prev = datapoints[datapoints.length - 2].usage;
    const curr = datapoints[datapoints.length - 1].usage;
    if (prev === 0) {
      const diff = curr - prev;
      if (diff === 0) return { text: '0%', color: 'var(--cp-text-muted)' };
      const pct = diff > 0 ? `+${diff}` : `${diff}`;
      return {
        text: pct,
        color: diff > 0 ? '#ef4444' : '#10b981'
      };
    }
    const pct = ((curr - prev) / prev) * 100;
    const rounded = Math.round(pct * 10) / 10;
    if (rounded === 0) return { text: '0%', color: 'var(--cp-text-muted)' };
    const text = rounded > 0 ? `+${rounded}%` : `${rounded}%`;
    return {
      text,
      color: rounded > 0 ? '#ef4444' : '#10b981'
    };
  };

  return (
    <div className="cp-metrics-bar">
      {metricsConfig.map((cfg) => {
        const metric = data[cfg.key];
        if (!metric) return null;
        const latest = metric.datapoints?.[metric.datapoints.length - 1]?.usage ?? 0;
        const trend = getTrendInfo(metric.datapoints);
        return (
          <div key={cfg.key} className="cp-metrics-bar-col">
            <span className="cp-metrics-bar-label">{cfg.label}</span>
            <div className="cp-metrics-bar-value-row">
              <span className="cp-metrics-bar-value">
                {cfg.formatVal(latest)}
              </span>
              <span className="cp-metrics-bar-trend" style={{ color: trend.color }}>
                {trend.text}
              </span>
            </div>
            <span className="cp-metrics-bar-limit">
              Limit: {cfg.formatVal(metric.limit)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function DashboardPage() {
  const { token, activeOrganization, branding } = useAuth();
  const { data, loading, error, refresh } = useDashboardSummary(token);
  const {
    items: recent,
    loading: nLoading,
    markRead,
  } = useNotifications(token, { limit: 5 });

  const isOrgAdmin = activeOrganization?.roleCode === 'org_admin';
  const isPlatformOperator = activeOrganization?.roleCode === 'sys_admin' || activeOrganization?.roleCode === 'super_admin';
  const {
    data: metricsData,
    loading: metricsLoading,
    error: metricsError,
    refresh: refreshMetrics,
  } = useHostingMetrics(isOrgAdmin ? token : null);

  const handleRefreshAll = () => {
    refresh();
    if (isOrgAdmin) {
      refreshMetrics();
    }
  };

  if (loading && !data) {
    return <PageSpinner />;
  }

  return (
    <div className="cp-stack">
      <div className="cp-page-head">
        <div>
          <h1 className="cp-page-title">Dashboard</h1>
          <p className="cp-muted">
            Overview for <strong>{branding?.appName || activeOrganization?.name}</strong>
          </p>
        </div>
        <button type="button" className="cp-btn cp-btn-secondary" onClick={handleRefreshAll}>
          Refresh
        </button>
      </div>

      {error ? <div className="cp-alert">{error}</div> : null}

      {isOrgAdmin && (
        <HostingMetricsBar
          data={metricsData}
          loading={metricsLoading}
          error={metricsError}
        />
      )}

      {!isPlatformOperator && (
        <section className="cp-dashboard-widgets">
          <SalesOverviewCard
            accentColor="#16a34a"
            title="Accounts Summary"
            subtitle="Manage your accounts"
            rows={[
              { label: 'Active Accounts', value: loading ? '—' : String(data?.summary?.activeMembers ?? 0), delta: null },
            ]}
          />
        </section>
      )}

      <section className="cp-card cp-card-pad">
        <div className="cp-row">
          <h2 className="cp-section-title">Recent notifications</h2>
          <Link className="cp-link" to="/app/notifications">
            View all
          </Link>
        </div>
        {nLoading ? (
          <p className="cp-muted">Loading…</p>
        ) : recent.length === 0 ? (
          <p className="cp-muted">You are all caught up.</p>
        ) : (
          <ul className="cp-notify-list">
            {recent.map((n) => (
              <li key={n.id} className="cp-notify-item">
                <div>
                  <div className="cp-notify-title">{n.title}</div>
                  {n.body ? <div className="cp-muted cp-notify-body">{n.body}</div> : null}
                </div>
                <div className="cp-row">
                  <span className={`cp-tag cp-tag-${n.severity}`}>{n.severity}</span>
                  {!n.readAt ? (
                    <button
                      type="button"
                      className="cp-btn cp-btn-ghost"
                      onClick={() => markRead(n.id)}
                    >
                      Mark read
                    </button>
                  ) : (
                    <span className="cp-muted">Read</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

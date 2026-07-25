import { Link } from 'react-router-dom';
import { PageBreadcrumb } from '../components/PageBreadcrumb.jsx';

export function MaintenancePage() {
  return (
    <div className="cp-stack" style={{ width: '100%', minHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
      <PageBreadcrumb current="Under Maintenance" />
      
      <div 
        className="cp-card cp-card-pad" 
        style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          textAlign: 'center', 
          padding: '60px 20px',
          background: 'var(--cp-card-bg, #ffffff)',
          borderRadius: '12px',
          border: '1px solid var(--cp-border)'
        }}
      >
        <div 
          style={{ 
            width: '80px', 
            height: '80px', 
            borderRadius: '50%', 
            background: 'rgba(235, 94, 40, 0.1)', 
            color: 'rgb(235, 94, 40)',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            marginBottom: '24px'
          }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        </div>

        <h1 style={{ fontSize: '28px', fontWeight: '700', color: 'var(--cp-text-dark, #1e293b)', marginBottom: '12px' }}>
          Under Maintenance
        </h1>
        
        <p style={{ fontSize: '15px', color: 'var(--cp-text-muted, #64748b)', maxWidth: '480px', lineHeight: '1.6', marginBottom: '32px' }}>
          This section is currently undergoing scheduled upgrades to bring you new features and improved performance. We apologize for the inconvenience and will be back online shortly.
        </p>

        <Link 
          to="/app/dashboard" 
          className="cp-btn cp-btn-primary" 
          style={{ 
            padding: '10px 24px', 
            textDecoration: 'none', 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '8px' 
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 19-7-7 7-7M5 12h14" />
          </svg>
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

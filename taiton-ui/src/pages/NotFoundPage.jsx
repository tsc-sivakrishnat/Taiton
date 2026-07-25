import { Link } from 'react-router-dom';
import { PageBreadcrumb } from '../components/PageBreadcrumb.jsx';

export function NotFoundPage() {
  return (
    <div className="cp-stack" style={{ width: '100%', minHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
      <PageBreadcrumb current="404 Not Found" />
      
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
            background: 'rgba(239, 68, 68, 0.1)', 
            color: 'rgb(239, 68, 68)',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            marginBottom: '24px',
            fontSize: '24px',
            fontWeight: '800'
          }}
        >
          404
        </div>

        <h1 style={{ fontSize: '28px', fontWeight: '700', color: 'var(--cp-text-dark, #1e293b)', marginBottom: '12px' }}>
          Page Not Found
        </h1>
        
        <p style={{ fontSize: '15px', color: 'var(--cp-text-muted, #64748b)', maxWidth: '480px', lineHeight: '1.6', marginBottom: '32px' }}>
          Oops! The page you are looking for doesn't exist, has been removed, or is currently unavailable. Please verify the URL or return to the main dashboard.
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

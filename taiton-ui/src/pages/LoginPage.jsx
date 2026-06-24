import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { enterpriseApi } from '../api/enterpriseApi.js';
import { CompanyBranding } from '../components/CompanyBranding.jsx';
import { constants } from '../constants/CPanel_Constants.jsx';
import { useAuth } from '../context/authContext.js';
import { resolveBrandingAssetUrl, sanitizeLogoSrcForImg } from '../utils/brandingAssetValidation.js';

const REMEMBER_EMAIL_KEY = 'cpanel.rememberedEmail';

const iconProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

function IconMail() {
  return (
    <svg {...iconProps}>
      <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      <path d="m22 6-10 7L2 6" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg {...iconProps}>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function IconEye() {
  return (
    <svg {...iconProps}>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEyeOff() {
  return (
    <svg {...iconProps}>
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}

export function LoginPage() {
  const { login, isAuthenticated, bootstrapping, error, setError } = useAuth();
  const location = useLocation();
  const [publicBranding, setPublicBranding] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [view, setView] = useState('login'); // 'login' or 'forgot'
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState('');

  useEffect(() => {
    const org =
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PUBLIC_ORG_CODE) || 'acme';
    let cancelled = false;
    enterpriseApi
      .publicBranding({ org })
      .then((res) => {
        if (!cancelled) setPublicBranding(res?.branding ?? null);
      })
      .catch(() => {
        if (!cancelled) setPublicBranding(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (bootstrapping) {
    return (
      <div className="cp-login">
        <p className="cp-muted">Loading session…</p>
      </div>
    );
  }

  if (isAuthenticated) {
    const to = location.state?.from?.pathname || '/app/dashboard';
    return <Navigate to={to} replace />;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login({ email, password });
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function onForgotSubmit(e) {
    e.preventDefault();
    setForgotSubmitting(true);
    setError(null);
    try {
      const res = await enterpriseApi.forgotPassword({ email: forgotEmail });
      setForgotSuccess(res.message || 'Reset link sent! Please check your email.');
    } catch (err) {
      setError(err.message || 'Failed to send reset link.');
    } finally {
      setForgotSubmitting(false);
    }
  }

  const brand = String(constants.brandName || 'Enterprise Panel');
  const badge = brand
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const displayName =
    (publicBranding?.appName && String(publicBranding.appName).trim()) || brand;

  if (view === 'forgot') {
    return (
      <div className="cp-login">
        <div className="cp-login-card cp-login-card--v2">
          <div className="cp-login-brand-block" style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <img
              src={publicBranding?.logoUrl ? resolveBrandingAssetUrl(sanitizeLogoSrcForImg(publicBranding.logoUrl)) : '/images.png'}
              alt="Logo"
              className="cp-login-logo"
              style={{ height: '46px', objectFit: 'contain' }}
              onError={(e) => {
                e.target.src = '/images.png';
              }}
            />
          </div>
          <h1 className="cp-login-title cp-login-title--v2">Forgot Password</h1>
          <p className="cp-login-sub">Enter your email to receive a password reset link.</p>

          {forgotSuccess ? (
            <div className="cp-alert cp-alert--success" style={{ backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', padding: '12px', borderRadius: '6px', fontSize: '14px', marginBottom: '16px' }}>
              {forgotSuccess}
            </div>
          ) : (
            <form className="cp-form cp-login-form" onSubmit={onForgotSubmit}>
              <label className="cp-field cp-login-field">
                <span className="cp-login-label">Email</span>
                <div className="cp-login-input">
                  <span className="cp-login-input-icon">
                    <IconMail />
                  </span>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                    placeholder="Enter your email"
                  />
                </div>
              </label>

              {error ? <div className="cp-alert">{error}</div> : null}

              <button className="cp-btn cp-btn-primary cp-login-submit" type="submit" disabled={forgotSubmitting}>
                {forgotSubmitting ? 'Sending link…' : 'Send reset link'}
              </button>
            </form>
          )}

          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <button
              type="button"
              onClick={() => {
                setView('login');
                setError(null);
                setForgotSuccess('');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--cp-text-muted, #64748b)',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
              }}
            >
              ← Back to Sign In
            </button>
          </div>

          <div className="cp-login-foot">
            © {new Date().getFullYear()} {displayName} by Techtrole. All rights reserved.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cp-login">
      <div className="cp-login-card cp-login-card--v2">
        <div className="cp-login-brand-block" style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <img
            src={publicBranding?.logoUrl ? resolveBrandingAssetUrl(sanitizeLogoSrcForImg(publicBranding.logoUrl)) : '/images.png'}
            alt="Logo"
            className="cp-login-logo"
            style={{ height: '46px', objectFit: 'contain' }}
            onError={(e) => {
              e.target.src = '/images.png';
            }}
          />
        </div>
        <h1 className="cp-login-title cp-login-title--v2">{brand}</h1>
        <p className="cp-login-sub">Enterprise Accounts Management System</p>

        <form className="cp-form cp-login-form" onSubmit={onSubmit}>
          <label className="cp-field cp-login-field">
            <span className="cp-login-label">Email</span>
            <div className="cp-login-input">
              <span className="cp-login-input-icon">
                <IconMail />
              </span>
              <input
                autoComplete="username"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your email"
              />
            </div>
          </label>

          <label className="cp-field cp-login-field">
            <span className="cp-login-label">Password</span>
            <div className="cp-login-input cp-login-input--password">
              <span className="cp-login-input-icon">
                <IconLock />
              </span>
              <input
                autoComplete="current-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
              />
              <button
                type="button"
                className="cp-login-eye"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px', marginBottom: '12px' }}>
            <button
              type="button"
              onClick={() => {
                setView('forgot');
                setError(null);
                setForgotSuccess('');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--cp-primary, #3b82f6)',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500,
                padding: 0,
              }}
            >
              Forgot password?
            </button>
          </div>

          {error ? <div className="cp-alert">{error}</div> : null}

          <button className="cp-btn cp-btn-primary cp-login-submit" type="submit" disabled={submitting}>
            {submitting ? (
              'Signing in…'
            ) : (
              <>
                Sign in
                <span className="cp-login-submit-arrow" aria-hidden>
                  →
                </span>
              </>
            )}
          </button>
        </form>

        <div className="cp-login-foot">
          © {new Date().getFullYear()} {displayName} by Techtrole. All rights reserved.
        </div>
      </div>
    </div>
  );
}

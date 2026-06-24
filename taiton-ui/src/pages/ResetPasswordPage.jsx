import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { enterpriseApi } from '../api/enterpriseApi.js';
import { resolveBrandingAssetUrl, sanitizeLogoSrcForImg } from '../utils/brandingAssetValidation.js';
import { constants } from '../constants/CPanel_Constants.jsx';

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

function IconLock() {
  return (
    <svg {...iconProps}>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [publicBranding, setPublicBranding] = useState(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

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

  const brand = String(constants.brandName || 'Enterprise Panel');
  const displayName =
    (publicBranding?.appName && String(publicBranding.appName).trim()) || brand;

  async function onSubmit(e) {
    e.preventDefault();
    if (!token) {
      setError('Invalid or missing password reset token.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await enterpriseApi.resetPassword({ token, password });
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Failed to reset password. The link may have expired.');
    } finally {
      setSubmitting(false);
    }
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
        <h1 className="cp-login-title cp-login-title--v2">Reset Password</h1>
        <p className="cp-login-sub">Choose a secure new password for your account.</p>

        {success ? (
          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <div className="cp-alert cp-alert--success" style={{ backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', padding: '12px', borderRadius: '6px', fontSize: '14px', marginBottom: '16px', textAlign: 'left' }}>
              Password updated successfully! You can now log in with your new password.
            </div>
            <Link to="/login" className="cp-btn cp-btn-primary cp-login-submit" style={{ display: 'block', textDecoration: 'none', textAlign: 'center', marginTop: '20px' }}>
              Sign In
            </Link>
          </div>
        ) : (
          <form className="cp-form cp-login-form" onSubmit={onSubmit}>
            {!token ? (
              <div className="cp-alert">Invalid or expired reset password link.</div>
            ) : (
              <>
                <label className="cp-field cp-login-field">
                  <span className="cp-login-label">New Password</span>
                  <div className="cp-login-input">
                    <span className="cp-login-input-icon">
                      <IconLock />
                    </span>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="Enter new password"
                    />
                  </div>
                </label>

                <label className="cp-field cp-login-field" style={{ marginTop: '12px' }}>
                  <span className="cp-login-label">Confirm New Password</span>
                  <div className="cp-login-input">
                    <span className="cp-login-input-icon">
                      <IconLock />
                    </span>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="Confirm new password"
                    />
                  </div>
                </label>

                {error ? <div className="cp-alert">{error}</div> : null}

                <button className="cp-btn cp-btn-primary cp-login-submit" type="submit" disabled={submitting}>
                  {submitting ? 'Updating password…' : 'Update Password'}
                </button>
              </>
            )}
          </form>
        )}

        <div className="cp-login-foot">
          © {new Date().getFullYear()} {displayName} by Techtrole. All rights reserved.
        </div>
      </div>
    </div>
  );
}

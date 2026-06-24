import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { resolveBrandingAssetUrl, sanitizeLogoSrcForImg } from '../utils/brandingAssetValidation.js';

export function CompanyBranding({
  branding,
  fallbackName,
  variant = 'sidebar',
  compact,
  linkToDashboard = false,
}) {
  const appName = branding?.appName || fallbackName || 'Company';
  const logoWide = resolveBrandingAssetUrl(sanitizeLogoSrcForImg(branding?.logoUrl));
  const logoCollapsed = resolveBrandingAssetUrl(sanitizeLogoSrcForImg(branding?.logoUrlCollapsed ?? ''));
  const profile = branding?.logoProfile === 'logo_name' ? 'logo_name' : 'horizontal';
  const [failedWide, setFailedWide] = useState(false);
  const [failedCollapsed, setFailedCollapsed] = useState(false);

  const wideSrc = logoWide;
  const miniSrc =
    profile === 'horizontal'
      ? logoCollapsed || logoWide
      : logoCollapsed || logoWide;

  useEffect(() => {
    setFailedWide(false);
    setFailedCollapsed(false);
  }, [logoWide, logoCollapsed, profile, compact]);

  const rootClass = [
    'cp-branding',
    variant === 'preview' && 'cp-branding--preview',
    variant === 'sidebar' && 'cp-branding--sidebar',
  ]
    .filter(Boolean)
    .join(' ');
  const remountKey = `${compact}-${wideSrc}-${miniSrc}-${appName}-${profile}-${variant}`;

  function wrap(node) {
    if (linkToDashboard && variant === 'sidebar') {
      return (
        <NavLink
          to="/app/dashboard"
          className="cp-sidebar-brand-link"
          title="Dashboard"
          end
        >
          {node}
        </NavLink>
      );
    }
    return node;
  }

  if (compact) {
    const inner = (
      <div key={remountKey} className={`${rootClass} cp-branding--mini`}>
        {miniSrc && !failedCollapsed ? (
          <img
            src={miniSrc}
            alt=""
            className="cp-branding-mini-img"
            onError={() => setFailedCollapsed(true)}
          />
        ) : (
          <span className="cp-branding-fallback" aria-hidden>
            {appName.slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>
    );
    return wrap(inner);
  }

  if (profile === 'logo_name') {
    const rowSrc = logoWide;
    const inner = (
      <div key={remountKey} className={`${rootClass} cp-branding--row`}>
        {rowSrc && !failedWide ? (
          <img
            src={rowSrc}
            alt=""
            className="cp-branding-logo-square"
            onError={() => setFailedWide(true)}
          />
        ) : (
          <span className="cp-branding-fallback cp-branding-fallback--sq" aria-hidden>
            {appName.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="cp-branding-name">{appName}</span>
      </div>
    );
    return wrap(inner);
  }

  const inner = (
    <div key={remountKey} className={`${rootClass} cp-branding--banner`}>
      {wideSrc && !failedWide ? (
        <img
          src={wideSrc}
          alt=""
          className="cp-branding-banner-img"
          onError={() => setFailedWide(true)}
        />
      ) : (
        <span className="cp-branding-name cp-branding-name--solo">{appName}</span>
      )}
    </div>
  );
  return wrap(inner);
}

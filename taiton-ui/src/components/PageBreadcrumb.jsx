import { Link } from 'react-router-dom';

/** Breadcrumb: Dashboard is plain text style; current page is muted. */
export function PageBreadcrumb({ current, parent, parentUrl }) {
  if (current === 'Dashboard') {
    return (
      <p className="cp-page-breadcrumb">
        <span className="cp-page-breadcrumb-current">Dashboard</span>
      </p>
    );
  }
  return (
    <p className="cp-page-breadcrumb">
      <Link to="/app/dashboard" className="cp-page-breadcrumb-link">
        Dashboard
      </Link>
      <span className="cp-page-breadcrumb-sep" aria-hidden>
        /
      </span>
      {parent && parentUrl && (
        <>
          <Link to={parentUrl} className="cp-page-breadcrumb-link">
            {parent}
          </Link>
          <span className="cp-page-breadcrumb-sep" aria-hidden>
            /
          </span>
        </>
      )}
      <span className="cp-page-breadcrumb-current">{current}</span>
    </p>
  );
}

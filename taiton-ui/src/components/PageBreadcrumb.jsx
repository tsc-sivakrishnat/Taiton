import { Link } from 'react-router-dom';

/** Breadcrumb: Dashboard is plain text style; current page is muted. */
export function PageBreadcrumb({ current }) {
  return (
    <p className="cp-page-breadcrumb">
      <Link to="/app/dashboard" className="cp-page-breadcrumb-link">
        Dashboard
      </Link>
      <span className="cp-page-breadcrumb-sep" aria-hidden>
        /
      </span>
      <span className="cp-page-breadcrumb-current">{current}</span>
    </p>
  );
}

import { Navigate, useLocation } from 'react-router-dom';
import { AccessDenied } from '../components/AccessDenied.jsx';
import { isKnownAppRoute, normalizeRoute } from '../utils/navRouteAccess.js';

/** Renders org-defined nav items whose route is not a built-in module page. */
export function CustomNavPage() {
  const location = useLocation();
  const path = normalizeRoute(location.pathname);

  if (isKnownAppRoute(path)) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return <AccessDenied />;
}

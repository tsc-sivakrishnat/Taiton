import { usePermissions } from '../hooks/usePermissions.js';
import { AccessDenied } from '../components/AccessDenied.jsx';
import { useAuth } from '../context/authContext.js';
import { useLocation } from 'react-router-dom';
import { normalizeRoute } from '../utils/navRouteAccess.js';

/**
 * Route guard: platformAdmin OR permission code (org_admin bypasses non-platform perms in usePermissions).
 */
export function PermissionRoute({ permission, platformOnly, children }) {
  const { can, isPlatformAdmin } = usePermissions();
  const { navItems } = useAuth();
  const location = useLocation();

  if (platformOnly) {
    if (!isPlatformAdmin) {
      return (
        <AccessDenied message="Platform administrator access is required." />
      );
    }
    return children;
  }

  if (permission && !can(permission)) {
    return <AccessDenied />;
  }

  return children;
}

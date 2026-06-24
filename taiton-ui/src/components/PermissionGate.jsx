import { usePermissions } from '../hooks/usePermissions.js';

/** Renders children only when the current role has the given permission code. */
export function PermissionGate({ permission, children, fallback = null }) {
  const { can } = usePermissions();
  if (!permission || can(permission)) {
    return children;
  }
  return fallback;
}

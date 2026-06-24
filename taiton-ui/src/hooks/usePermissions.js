import { useContext, useMemo } from 'react';
import { AuthContext } from '../context/authContext.js';

const PLATFORM_ROLES = new Set(['sys_admin', 'super_admin']);

export function usePermissions() {
  const ctx = useContext(AuthContext);
  const permissions = ctx?.permissions ?? [];
  const role = ctx?.activeOrganization?.roleCode ?? '';

  const permissionSet = useMemo(
    () => new Set(permissions.map((p) => p.code)),
    [permissions],
  );

  const can = (code) => {
    if (role === 'org_admin' && code && !String(code).startsWith('platform.')) {
      return true;
    }
    return permissionSet.has(code);
  };

  return {
    role,
    permissions,
    can,
    isPlatformAdmin: PLATFORM_ROLES.has(role),
  };
}

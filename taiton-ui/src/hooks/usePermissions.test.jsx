import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { AuthContext } from '../context/authContext.js';
import { usePermissions } from './usePermissions.js';

function wrapper({ role, permissions = [] }) {
  return function Wrapper({ children }) {
    return (
      <AuthContext.Provider
        value={{
          activeOrganization: { roleCode: role },
          permissions,
        }}
      >
        {children}
      </AuthContext.Provider>
    );
  };
}

describe('usePermissions', () => {
  it('org_admin can access non-platform permissions', () => {
    const { result } = renderHook(() => usePermissions(), {
      wrapper: wrapper({ role: 'org_admin' }),
    });
    expect(result.current.can('org.users.manage')).toBe(true);
    expect(result.current.can('platform.orgs.manage')).toBe(false);
  });

  it('employee uses permission set', () => {
    const { result } = renderHook(() => usePermissions(), {
      wrapper: wrapper({
        role: 'employee',
        permissions: [{ code: 'content.products.read' }],
      }),
    });
    expect(result.current.can('content.products.read')).toBe(true);
    expect(result.current.can('org.users.manage')).toBe(false);
  });

  it('identifies platform admin', () => {
    const { result } = renderHook(() => usePermissions(), {
      wrapper: wrapper({ role: 'sys_admin' }),
    });
    expect(result.current.isPlatformAdmin).toBe(true);
  });
});

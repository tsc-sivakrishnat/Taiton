import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthContext } from '../context/authContext.js';
import { PermissionRoute } from './PermissionRoute.jsx';
import { PERMISSIONS } from '../constants/permissions.js';

import { MemoryRouter } from 'react-router-dom';

function renderWithRole(role, permissions, ui) {
  return render(
    <AuthContext.Provider
      value={{
        activeOrganization: { roleCode: role },
        permissions,
        navItems: [],
      }}
    >
      <MemoryRouter>{ui}</MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('PermissionRoute', () => {
  it('renders children when org_admin has permission', () => {
    renderWithRole(
      'org_admin',
      [],
      <PermissionRoute permission={PERMISSIONS.ORG_USERS}>
        <div>Protected content</div>
      </PermissionRoute>,
    );
    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });

  it('denies employee without permission', () => {
    renderWithRole(
      'employee',
      [],
      <PermissionRoute permission={PERMISSIONS.ORG_USERS}>
        <div>Protected content</div>
      </PermissionRoute>,
    );
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    expect(screen.getByText(/access denied/i)).toBeInTheDocument();
  });

  it('denies non-platform user on platformOnly route', () => {
    renderWithRole(
      'org_admin',
      [],
      <PermissionRoute platformOnly>
        <div>Platform area</div>
      </PermissionRoute>,
    );
    expect(screen.getByText(/platform administrator/i)).toBeInTheDocument();
  });
});

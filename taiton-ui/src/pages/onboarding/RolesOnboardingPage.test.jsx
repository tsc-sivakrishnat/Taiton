import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthContext } from '../../context/authContext.js';
import { RolesOnboardingPage } from './RolesOnboardingPage.jsx';
import { MemoryRouter } from 'react-router-dom';
import { enterpriseApi } from '../../api/enterpriseApi.js';

vi.mock('../../api/enterpriseApi.js', () => ({
  enterpriseApi: {
    platformOrganizations: vi.fn(),
    platformOrgRoles: vi.fn(),
  },
}));

describe('RolesOnboardingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders roles and shows members button for org_admin', async () => {
    enterpriseApi.platformOrganizations.mockResolvedValue({
      organizations: [{ id: 1, name: 'Acme Corporation', code: 'acme' }],
    });
    enterpriseApi.platformOrgRoles.mockResolvedValue({
      roles: [
        { id: 10, code: 'org_admin', name: 'Organization Admin', priority: 10, description: 'Admin role' },
        { id: 11, code: 'employee', name: 'Employee', priority: 20, description: 'Standard employee' },
      ],
    });

    render(
      <AuthContext.Provider value={{ token: 'mock-token', activeOrganization: { roleCode: 'sys_admin' } }}>
        <MemoryRouter initialEntries={['/app/onboarding/roles?orgId=1']}>
          <RolesOnboardingPage />
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    // Verify it loads roles and renders organization admin card
    await waitFor(() => {
      expect(screen.getByText('Organization Admin')).toBeInTheDocument();
    });

    // Check role name input placeholder is 'eg. Employee'
    const nameInput = screen.getByPlaceholderText('eg. Employee');
    expect(nameInput).toBeInTheDocument();

    // Verify org_admin card has a members button, not Protected text
    const membersBtn = screen.getByTitle('Members');
    expect(membersBtn).toBeInTheDocument();
    expect(membersBtn.closest('a')).toHaveAttribute('href', '/app/onboarding/members?orgId=1');

    // Verify employee role card has a delete button
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });
});

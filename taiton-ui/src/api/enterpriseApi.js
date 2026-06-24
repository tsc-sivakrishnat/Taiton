/**
 * Single module: API base URL, route paths, HTTP helper, and domain calls.
 * Keeps fetch logic centralized so routes and components stay thin.
 */

const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE) ||
  '';

/** Logical paths (relative to API_BASE). */
export const API_PATHS = {
  health: '/api/health',
  public: {
    branding: '/api/public/branding',
  },
  auth: {
    login: '/api/auth/login',
    me: '/api/auth/me',
    session: '/api/auth/session',
    logout: '/api/auth/logout',
    sessionExpired: '/api/auth/session-expired',
  },
  dashboard: {
    summary: '/api/dashboard/summary',
  },
  notifications: {
    list: '/api/notifications',
    read: (id) => `/api/notifications/${id}/read`,
    readAll: '/api/notifications/read-all',
  },
  navigation: {
    list: '/api/navigation',
  },
  org: {
    branding: '/api/org/branding',
    brandingLogo: '/api/org/branding/logo',
    config: '/api/org/config',
    configKey: (key) => `/api/org/config/${key}`,
    approvalRules: '/api/org/approval-rules',
  },
  admin: {
    roles: '/api/admin/roles',
    actors: '/api/admin/actors',
    actorsExport: '/api/admin/actors/export',
  },
  platform: {
    base: '/api/platform',
    orgNav: (orgId) => `/api/platform/organizations/${orgId}/nav`,
    orgAdmin: (orgId) => `/api/platform/organizations/${orgId}/org-admin`,
    orgAdmins: (orgId) => `/api/platform/organizations/${orgId}/org-admins`,
    orgAdminUser: (orgId, userId) => `/api/platform/organizations/${orgId}/org-admins/${userId}`,
  },
  customerRequests: '/api/customer-requests',
  content: (type) => `/api/content/${type}`,
  contentApprove: (type, id) => `/api/content/${type}/${id}/approve`,
  permissions: {
    me: '/api/permissions/me',
    audit: '/api/permissions/audit',
  },
  support: {
    tickets: '/api/support/tickets',
    ticket: (id) => `/api/support/tickets/${id}`,
    ticketStatus: (id) => `/api/support/tickets/${id}/status`,
    attachment: (ticketId, attachmentId) =>
      `/api/support/tickets/${ticketId}/attachments/${attachmentId}`,
  },
};

async function request(path, { method = 'GET', token, body, search } = {}) {
  const base = API_BASE || (typeof window !== 'undefined' ? window.location.origin : '');
  const url = new URL(path, base);
  if (search && typeof search === 'object') {
    Object.entries(search).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, String(v));
      }
    });
  }
  const headers = { Accept: 'application/json' };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const parsed = (() => {
    try {
      return text ? JSON.parse(text) : null;
    } catch {
      return { error: text || 'Invalid response' };
    }
  })();
  if (!res.ok) {
    const err = new Error(parsed?.error || res.statusText || 'Request failed');
    err.status = res.status;
    err.body = parsed;
    throw err;
  }
  return parsed;
}

function resolveApiUrl(path) {
  const base = API_BASE || (typeof window !== 'undefined' ? window.location.origin : '');
  return new URL(path, base).toString();
}

async function fetchAuthorizedText(path, { token, search } = {}) {
  const base = API_BASE || (typeof window !== 'undefined' ? window.location.origin : '');
  const url = new URL(path, base);
  if (search && typeof search === 'object') {
    Object.entries(search).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, String(v));
      }
    });
  }
  const headers = { Accept: 'text/csv, application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(url.toString(), {
    headers,
  });
  const text = await res.text();
  if (!res.ok) {
    try {
      const parsed = text ? JSON.parse(text) : null;
      const err = new Error(parsed?.error || text || res.statusText || 'Request failed');
      err.status = res.status;
      err.body = parsed;
      throw err;
    } catch (e) {
      if (e.message && e.status !== undefined) throw e;
      const err = new Error(text || res.statusText || 'Request failed');
      err.status = res.status;
      throw err;
    }
  }
  return text;
}

async function requestFormData(path, { token, formData, method = 'POST' } = {}) {
  const url = resolveApiUrl(path);
  const headers = { Accept: 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(url, { method, headers, body: formData });
  const text = await res.text();
  const parsed = (() => {
    try {
      return text ? JSON.parse(text) : null;
    } catch {
      return { error: text || 'Invalid response' };
    }
  })();
  if (!res.ok) {
    const err = new Error(parsed?.error || res.statusText || 'Request failed');
    err.status = res.status;
    err.body = parsed;
    throw err;
  }
  return parsed;
}

async function fetchAuthorizedBlob(path, token) {
  const url = resolveApiUrl(path);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = new Error(res.statusText || 'Download failed');
    err.status = res.status;
    throw err;
  }
  return res.blob();
}

export const enterpriseApi = {
  health: () => request(API_PATHS.health),

  publicBranding: ({ org } = {}) =>
    request(API_PATHS.public.branding, { method: 'GET', search: { org } }),

  login: (payload) =>
    request(API_PATHS.auth.login, { method: 'POST', body: payload }),

  forgotPassword: (payload) =>
    request('/api/auth/forgot-password', { method: 'POST', body: payload }),

  resetPassword: (payload) =>
    request('/api/auth/reset-password', { method: 'POST', body: payload }),

  changePassword: (token, payload) =>
    request('/api/auth/change-password', { method: 'POST', token, body: payload }),

  session: (token) =>
    request(API_PATHS.auth.session, { method: 'GET', token }),

  logout: (token) =>
    request(API_PATHS.auth.logout, { method: 'POST', token }),

  sessionExpired: (token) =>
    request(API_PATHS.auth.sessionExpired, { method: 'POST', token }),

  dashboardSummary: (token) =>
    request(API_PATHS.dashboard.summary, { method: 'GET', token }),

  hostingMetrics: (token) =>
    request('/api/dashboard/hosting-metrics', { method: 'GET', token }),

  notifications: (token, { limit, offset } = {}) =>
    request(API_PATHS.notifications.list, {
      method: 'GET',
      token,
      search: { limit, offset },
    }),

  markNotificationRead: (token, id) =>
    request(API_PATHS.notifications.read(id), { method: 'PATCH', token }),

  markAllNotificationsRead: (token) =>
    request(API_PATHS.notifications.readAll, { method: 'POST', token }),

  navigation: (token) =>
    request(API_PATHS.navigation.list, { method: 'GET', token }),

  orgBranding: (token) =>
    request(API_PATHS.org.branding, { method: 'GET', token }),

  patchOrgBranding: (token, body) =>
    request(API_PATHS.org.branding, { method: 'PATCH', token, body }),

  uploadOrgBrandingLogo: (token, file, slot) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('slot', slot === 'collapsed' ? 'collapsed' : 'wide');
    return requestFormData(API_PATHS.org.brandingLogo, { token, formData: fd, method: 'POST' });
  },

  adminRoles: (token) =>
    request(API_PATHS.admin.roles, { method: 'GET', token }),

  adminRegisterActor: (token, body) =>
    request(API_PATHS.admin.actors, { method: 'POST', token, body }),

  adminDeleteActor: (token, userId) =>
    request(`${API_PATHS.admin.actors}/${userId}`, { method: 'DELETE', token }),

  adminActorsList: (token, { limit = 10, offset = 0, q } = {}) =>
    request(API_PATHS.admin.actors, {
      method: 'GET',
      token,
      search: {
        limit: String(limit),
        offset: String(offset),
        ...(q ? { q: String(q) } : {}),
      },
    }),

  adminActorsExportCsv: (token, { q } = {}) =>
    fetchAuthorizedText(API_PATHS.admin.actorsExport, {
      token,
      search: q ? { q: String(q) } : {},
    }),

  supportTickets: (token, { scope = 'mine', limit } = {}) =>
    request(API_PATHS.support.tickets, {
      method: 'GET',
      token,
      search: { scope, limit },
    }),

  supportTicket: (token, id) =>
    request(API_PATHS.support.ticket(id), { method: 'GET', token }),

  supportCreateTicket: (token, formData) =>
    requestFormData(API_PATHS.support.tickets, { token, formData }),

  supportUpdateTicketStatus: (token, ticketId, status) =>
    request(API_PATHS.support.ticketStatus(ticketId), {
      method: 'PATCH',
      token,
      body: { status },
    }),

  supportDownloadAttachment: (token, ticketId, attachmentId) =>
    fetchAuthorizedBlob(API_PATHS.support.attachment(ticketId, attachmentId), token),

  myPermissions: (token) =>
    request(API_PATHS.permissions.me, { method: 'GET', token }),

  auditLog: (token, { limit, offset } = {}) =>
    request(API_PATHS.permissions.audit, { method: 'GET', token, search: { limit, offset } }),

  platformOrganizations: (token) =>
    request(`${API_PATHS.platform.base}/organizations`, { method: 'GET', token }),

  platformCreateOrganization: (token, body) =>
    request(`${API_PATHS.platform.base}/organizations`, { method: 'POST', token, body }),

  platformRoles: (token) =>
    request(`${API_PATHS.platform.base}/roles`, { method: 'GET', token }),

  platformCreateOrgAdmin: (token, orgId, body) =>
    request(API_PATHS.platform.orgAdmin(orgId), { method: 'POST', token, body }),

  platformOrgAdmins: (token, orgId) =>
    request(API_PATHS.platform.orgAdmins(orgId), { method: 'GET', token }),

  platformUpdateOrgAdmin: (token, orgId, userId, body) =>
    request(API_PATHS.platform.orgAdminUser(orgId, userId), { method: 'PATCH', token, body }),

  platformDeleteOrgAdmin: (token, orgId, userId) =>
    request(API_PATHS.platform.orgAdminUser(orgId, userId), { method: 'DELETE', token }),

  platformNav: (token, orgId) =>
    request(API_PATHS.platform.orgNav(orgId), { method: 'GET', token }),

  platformUpsertNav: (token, orgId, body) =>
    request(API_PATHS.platform.orgNav(orgId), { method: 'POST', token, body }),

  platformUpsertRole: (token, body) =>
    request(`${API_PATHS.platform.base}/roles`, { method: 'POST', token, body }),

  platformPriorityOneRoles: (token, orgId) =>
    request(`${API_PATHS.platform.base}/organizations/${orgId}/roles/priority-one`, {
      method: 'GET',
      token,
    }),

  platformCreateMember: (token, orgId, body) =>
    request(`${API_PATHS.platform.base}/organizations/${orgId}/members`, {
      method: 'POST',
      token,
      body,
    }),

  platformAssignableRoles: (token, orgId) =>
    request(`${API_PATHS.platform.base}/organizations/${orgId}/assignable-roles`, {
      method: 'GET',
      token,
    }),

  platformOrgRoles: (token, orgId) =>
    request(`${API_PATHS.platform.base}/organizations/${orgId}/roles`, { method: 'GET', token }),

  platformCreateOrgRole: (token, orgId, body) =>
    request(`${API_PATHS.platform.base}/organizations/${orgId}/roles`, {
      method: 'POST',
      token,
      body,
    }),

  platformDeleteOrgRole: (token, orgId, roleCode) =>
    request(`${API_PATHS.platform.base}/organizations/${orgId}/roles/${encodeURIComponent(roleCode)}`, {
      method: 'DELETE',
      token,
    }),

  platformNavIcons: (token) =>
    request(`${API_PATHS.platform.base}/nav-icons`, { method: 'GET', token }),

  orgUpdateTheme: (token, theme) =>
    request('/api/org/theme', { method: 'PATCH', token, body: { theme } }),

  resetOrgAppearance: (token) =>
    request('/api/org/appearance/reset', { method: 'POST', token }),

  platformDeleteNav: (token, orgId, navId) =>
    request(`${API_PATHS.platform.base}/organizations/${orgId}/nav/${navId}`, {
      method: 'DELETE',
      token,
    }),

  orgRoles: (token) => request('/api/org/roles', { method: 'GET', token }),

  orgConfig: (token) => request(API_PATHS.org.config, { method: 'GET', token }),

  orgPutConfig: (token, key, value) =>
    request(API_PATHS.org.configKey(key), { method: 'PUT', token, body: { value } }),

  orgApprovalRules: (token) =>
    request(API_PATHS.org.approvalRules, { method: 'GET', token }),

  orgUpsertApprovalRule: (token, body) =>
    request(API_PATHS.org.approvalRules, { method: 'POST', token, body }),

  orgDeleteApprovalRule: (token, ruleId) =>
    request(`${API_PATHS.org.approvalRules}/${ruleId}`, { method: 'DELETE', token }),

  customerRequestsList: (token, params = {}) =>
    request(API_PATHS.customerRequests, { method: 'GET', token, search: params }),

  customerRequestCreate: (token, body) =>
    request(API_PATHS.customerRequests, { method: 'POST', token, body }),

  customerRequestUpdate: (token, id, body) =>
    request(`${API_PATHS.customerRequests}/${id}`, { method: 'PATCH', token, body }),

  contentList: (token, contentType, params = {}) =>
    request(API_PATHS.content(contentType), { method: 'GET', token, search: params }),

  contentCreate: (token, contentType, body) =>
    request(API_PATHS.content(contentType), { method: 'POST', token, body }),

  contentApprove: (token, contentType, id, body) =>
    request(API_PATHS.contentApprove(contentType, id), { method: 'POST', token, body }),

  orgNavigation: (token) =>
    request('/api/org/navigation', { method: 'GET', token }),

  pendingApprovals: (token) =>
    request('/api/content/pending', { method: 'GET', token }),

  approveItem: (token, id, body) =>
    request(`/api/content/approve/${id}`, { method: 'POST', token, body }),
};

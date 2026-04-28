async function request(path, options = {}) {
  const { organizationId, token, ...fetchOptions } = options;
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(organizationId ? { 'X-Organization-Id': String(organizationId) } : {}),
      ...(fetchOptions.headers || {}),
    },
    ...fetchOptions,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`${response.status} ${response.statusText}${detail ? ` — ${detail}` : ''}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

export const api = {
  login: (username, password) =>
    request('/api/org/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  session: (token) => request('/api/org/auth/session/', { token }),
  organizations: (token) => request('/admin/org/organizations/', { token }),
  organization: (organizationId, token) => request('/api/org/organization/', { organizationId, token }),
  contracts: (organizationId, token) => request('/api/org/contracts/', { organizationId, token }),
  contract: (id, organizationId, token) =>
    request(`/api/org/contracts/${id}/`, { organizationId, token }),
  updateContract: (id, body, organizationId, token) =>
    request(`/api/org/contracts/${id}/`, {
      method: 'PATCH',
      organizationId,
      token,
      body: JSON.stringify(body),
    }),
  createOrganization: (body, token) =>
    request('/admin/org/organizations/', {
      method: 'POST',
      token,
      body: JSON.stringify(body),
    }),
  updateOrganizationAdmin: (id, body, token) =>
    request(`/admin/org/organizations/${id}/`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(body),
    }),
  deleteOrganizationAdmin: (id, token) =>
    request(`/admin/org/organizations/${id}/`, {
      method: 'DELETE',
      token,
    }),
  createContractAdmin: (body, token) =>
    request('/admin/org/contracts/', {
      method: 'POST',
      token,
      body: JSON.stringify(body),
    }),
  updateContractAdmin: (id, body, token) =>
    request(`/admin/org/contracts/${id}/`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(body),
    }),
  deleteContractAdmin: (id, token) =>
    request(`/admin/org/contracts/${id}/`, {
      method: 'DELETE',
      token,
    }),
};

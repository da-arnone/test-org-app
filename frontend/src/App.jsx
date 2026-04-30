import React, { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import OrganizationPage from './pages/OrganizationPage';
import ContractsPage from './pages/ContractsPage';
import ContractDetailPage from './pages/ContractDetailPage';
import ProvidersPage from './pages/ProvidersPage';
import { api } from './api';
import './styles.css';

// The shell mounts this component under its own <Route path="/org/*">. All
// internal Routes use relative paths so they resolve correctly whether the app
// is running standalone (at /) or embedded under /org/.
export default function App() {
  const [token, setToken] = useState(localStorage.getItem('org_app_token') || '');
  const [sessionUser, setSessionUser] = useState(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authError, setAuthError] = useState(null);
  const [authLoading, setAuthLoading] = useState(Boolean(token));
  const [organizationId, setOrganizationId] = useState('');
  const [organizations, setOrganizations] = useState([]);
  const isOrgAdmin = (sessionUser?.profiles || []).some(
    (profile) => profile.appScope === 'org-app' && profile.role === 'org-admin'
  );

  useEffect(() => {
    if (!token) {
      setSessionUser(null);
      setAuthLoading(false);
      setOrganizations([]);
      return;
    }
    setAuthLoading(true);
    api
      .session(token)
      .then((user) => {
        setSessionUser(user);
        const firstOrg = user.organizationIds?.[0];
        setOrganizationId(firstOrg ? String(firstOrg) : '');
        setAuthError(null);
      })
      .catch((e) => {
        localStorage.removeItem('org_app_token');
        setToken('');
        setSessionUser(null);
        setOrganizationId('');
        setOrganizations([]);
        setAuthError(`Session expired: ${e.message}`);
      })
      .finally(() => setAuthLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token || !sessionUser) {
      setOrganizations([]);
      return;
    }
    const allowedSet = new Set((sessionUser.organizationIds || []).map((id) => Number(id)));
    api
      .organizations(token)
      .then((items) =>
        setOrganizations(
          isOrgAdmin ? items : items.filter((org) => allowedSet.has(Number(org.id)))
        )
      )
      .catch(() => setOrganizations([]));
  }, [token, sessionUser, isOrgAdmin]);

  useEffect(() => {
    if (organizationId || organizations.length === 0) return;
    setOrganizationId(String(organizations[0].id));
  }, [organizationId, organizations]);

  const login = async () => {
    setAuthLoading(true);
    try {
      const response = await api.login(loginUsername, loginPassword);
      localStorage.setItem('org_app_token', response.accessToken);
      setToken(response.accessToken);
      setSessionUser(response.user);
      const firstOrg = response.user.organizationIds?.[0];
      setOrganizationId(firstOrg ? String(firstOrg) : '');
      setAuthError(null);
      setLoginPassword('');
    } catch (e) {
      setAuthError(e.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('org_app_token');
    setToken('');
    setSessionUser(null);
    setOrganizationId('');
    setOrganizations([]);
    setAuthError(null);
  };

  const selectedOrganization = organizations.find(
    (org) => String(org.id) === String(organizationId)
  );
  const sortedOrganizations = [...organizations].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
  );

  if (!token || !sessionUser) {
    return (
      <div className="org-app">
        <header>
          <h1>org-app</h1>
        </header>
        <main>
          <section>
            <h2>Sign in with auth-app</h2>
            <p className="hint">
              Use your auth-app credentials. Access is granted only if your profile includes
              <code> org-app/org-app </code>
              with an organization context.
            </p>
            {authError ? <div className="error">Error: {authError}</div> : null}
            <p>
              <label htmlFor="username-input">Username</label>
              <input
                id="username-input"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
              />
            </p>
            <p>
              <label htmlFor="password-input">Password</label>
              <input
                id="password-input"
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
              />
            </p>
            <p>
              <button type="button" onClick={login} disabled={authLoading}>
                {authLoading ? 'Signing in...' : 'Sign in'}
              </button>
            </p>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="org-app">
      <header>
        <h1>org-app</h1>
        <div className="top-bar">
          <p className="status-line">
            Signed in as <strong>{sessionUser.username}</strong>
          </p>
          <button type="button" onClick={logout}>
            Logout
          </button>
        </div>
        <div className="organization-picker">
          <label htmlFor="global-organization-select">Organisation</label>
          <select
            id="global-organization-select"
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
            disabled={organizations.length === 0}
          >
            <option value="">Select an organisation...</option>
            {sortedOrganizations.map((org) => (
              <option key={org.id} value={String(org.id)}>
                {org.name}
              </option>
            ))}
          </select>
          {selectedOrganization ? (
            <span className="org-badge">
              {selectedOrganization.name} <strong>#{selectedOrganization.id}</strong>
            </span>
          ) : (
            <span className="status-line">
              Active: <strong>{organizationId ? `#${organizationId}` : 'none selected'}</strong>
            </span>
          )}
        </div>
        <nav>
          <NavLink to="contracts" className={({ isActive }) => (isActive ? 'active' : '')}>
            Contracts
          </NavLink>
          <NavLink to="organization" className={({ isActive }) => (isActive ? 'active' : '')}>
            Organization
          </NavLink>
          <NavLink to="providers" className={({ isActive }) => (isActive ? 'active' : '')}>
            Providers
          </NavLink>
        </nav>
      </header>
      <main>
        <Routes>
          <Route index element={<Navigate to="organization" replace />} />
          <Route
            path="organization"
            element={
              <OrganizationPage
                organizationId={organizationId}
                onOrganizationChange={setOrganizationId}
                allowedOrganizationIds={sessionUser.organizationIds || []}
                profiles={sessionUser.profiles || []}
                organizations={organizations}
                onOrganizationsChange={setOrganizations}
                token={token}
              />
            }
          />
          <Route
            path="contracts"
            element={
              <ContractsPage
                organizationId={organizationId}
                allowedOrganizationIds={sessionUser.organizationIds || []}
                profiles={sessionUser.profiles || []}
                username={sessionUser.username}
                token={token}
              />
            }
          />
          <Route
            path="contracts/:id"
            element={
              <ContractDetailPage
                organizationId={organizationId}
                allowedOrganizationIds={sessionUser.organizationIds || []}
                token={token}
              />
            }
          />
          <Route
            path="providers"
            element={
              <ProvidersPage
                organizationId={organizationId}
                allowedOrganizationIds={sessionUser.organizationIds || []}
                token={token}
              />
            }
          />
        </Routes>
      </main>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { api } from '../api';

export default function OrganizationPage({
  organizationId,
  onOrganizationChange,
  allowedOrganizationIds,
  profiles,
  organizations,
  onOrganizationsChange,
  token,
}) {
  const [availableOrganizations, setAvailableOrganizations] = useState([]);
  const [organization, setOrganization] = useState(null);
  const [error, setError] = useState(null);
  const [newOrganizationName, setNewOrganizationName] = useState('');
  const [creatingOrganization, setCreatingOrganization] = useState(false);
  const [editingOrganizationName, setEditingOrganizationName] = useState('');
  const [savingOrganization, setSavingOrganization] = useState(false);
  const [deletingOrganization, setDeletingOrganization] = useState(false);
  const [adminMessage, setAdminMessage] = useState('');
  const isOrgAdmin = (profiles || []).some(
    (profile) => profile.appScope === 'org-app' && profile.role === 'org-admin'
  );

  useEffect(() => {
    api.organizations(token).then(onOrganizationsChange).catch((e) => setError(e.message));
  }, [token, onOrganizationsChange]);

  useEffect(() => {
    const allowedSet = new Set((allowedOrganizationIds || []).map((id) => Number(id)));
    const filtered = isOrgAdmin
      ? organizations
      : organizations.filter((org) => allowedSet.has(Number(org.id)));
    setAvailableOrganizations(filtered);

    const selectedAllowed = isOrgAdmin || (organizationId && allowedSet.has(Number(organizationId)));
    if (!selectedAllowed && filtered.length > 0) {
      onOrganizationChange(String(filtered[0].id));
    }
  }, [allowedOrganizationIds, organizations, organizationId, onOrganizationChange, isOrgAdmin]);

  useEffect(() => {
    if (!organizationId) {
      setOrganization(null);
      setEditingOrganizationName('');
      return;
    }
    if (isOrgAdmin) {
      const selected = organizations.find((org) => String(org.id) === String(organizationId));
      setOrganization(selected || null);
      setEditingOrganizationName(selected?.name || '');
      return;
    }
    api
      .organization(organizationId, token)
      .then((org) => {
        setOrganization(org);
        setEditingOrganizationName(org?.name || '');
      })
      .catch((e) => setError(e.message));
  }, [organizationId, token, organizations, isOrgAdmin]);

  if (error) return <div className="error">Error: {error}</div>;
  if (organizations.length === 0) return <div>Loading organisations…</div>;

  const createOrganization = async () => {
    const name = newOrganizationName.trim();
    if (!name) {
      setAdminMessage('Organization name is required.');
      return;
    }
    setCreatingOrganization(true);
    setAdminMessage('');
    try {
      const created = await api.createOrganization({ name }, token);
      const nextOrganizations = [...organizations, created].sort((a, b) => a.id - b.id);
      onOrganizationsChange(nextOrganizations);
      onOrganizationChange(String(created.id));
      setNewOrganizationName('');
      setAdminMessage(`Organization created: #${created.id} ${created.name}`);
    } catch (e) {
      setAdminMessage(`Failed to create organization: ${e.message}`);
    } finally {
      setCreatingOrganization(false);
    }
  };

  const saveOrganization = async () => {
    if (!organizationId) return;
    setSavingOrganization(true);
    setAdminMessage('');
    try {
      const updated = await api.updateOrganizationAdmin(
        Number(organizationId),
        { name: editingOrganizationName },
        token
      );
      onOrganizationsChange(
        organizations.map((item) => (item.id === updated.id ? updated : item))
      );
      setOrganization(updated);
      setAdminMessage(`Organization updated: #${updated.id}`);
    } catch (e) {
      setAdminMessage(`Failed to update organization: ${e.message}`);
    } finally {
      setSavingOrganization(false);
    }
  };

  const deleteOrganization = async () => {
    if (!organizationId) return;
    const confirmed = window.confirm(
      `Delete organization #${organizationId}? This cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingOrganization(true);
    setAdminMessage('');
    try {
      await api.deleteOrganizationAdmin(Number(organizationId), token);
      const remaining = organizations.filter((item) => item.id !== Number(organizationId));
      onOrganizationsChange(remaining);
      onOrganizationChange(remaining[0] ? String(remaining[0].id) : '');
      setAdminMessage(`Organization deleted: #${organizationId}`);
    } catch (e) {
      setAdminMessage(`Failed to delete organization: ${e.message}`);
    } finally {
      setDeletingOrganization(false);
    }
  };

  return (
    <section>
      <h2>Organization details</h2>
      <p>The active organisation is selected from the top bar.</p>
      {availableOrganizations.length === 0 ? (
        <p className="hint">Your account has no org-app organization access.</p>
      ) : null}
      <p className="hint">
        To switch organization context, use the selector at the top of the application, then
        navigate to Contracts.
      </p>
      {organization ? (
        <dl>
          <dt>ID</dt>
          <dd>{organization.id}</dd>
          <dt>Name</dt>
          <dd>{organization.name || <em>(unset)</em>}</dd>
        </dl>
      ) : (
        <p className="hint">No organisation selected yet.</p>
      )}
      {isOrgAdmin ? (
        <section className="admin-panel">
          <h3>Create organization (org-admin)</h3>
          <p className="hint">
            Admin role can create organizations through the admin surface.
          </p>
          <p>
            <label htmlFor="new-org-name">Name</label>
            <input
              id="new-org-name"
              value={newOrganizationName}
              onChange={(e) => setNewOrganizationName(e.target.value)}
              placeholder="New organization name"
            />
          </p>
          <p>
            <button type="button" onClick={createOrganization} disabled={creatingOrganization}>
              {creatingOrganization ? 'Creating…' : 'Create organization'}
            </button>
          </p>
          {organization ? (
            <>
              <h3>Manage selected organization</h3>
              <p>
                <label htmlFor="edit-org-name">Name</label>
                <input
                  id="edit-org-name"
                  value={editingOrganizationName}
                  onChange={(e) => setEditingOrganizationName(e.target.value)}
                />
              </p>
              <p className="row-actions">
                <button type="button" onClick={saveOrganization} disabled={savingOrganization}>
                  {savingOrganization ? 'Saving…' : 'Save name'}
                </button>
                <button
                  type="button"
                  onClick={deleteOrganization}
                  disabled={deletingOrganization}
                  className="danger"
                >
                  {deletingOrganization ? 'Deleting…' : 'Delete organization'}
                </button>
              </p>
            </>
          ) : null}
          {adminMessage ? <p className="hint">{adminMessage}</p> : null}
        </section>
      ) : null}
    </section>
  );
}

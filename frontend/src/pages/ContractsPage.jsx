import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function ContractsPage({
  organizationId,
  allowedOrganizationIds,
  profiles,
  username,
  token,
}) {
  const [contracts, setContracts] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newRef, setNewRef] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creatingContract, setCreatingContract] = useState(false);
  const [editingContractId, setEditingContractId] = useState(null);
  const [editingRef, setEditingRef] = useState('');
  const [savingContractId, setSavingContractId] = useState(null);
  const [deletingContractId, setDeletingContractId] = useState(null);
  const [adminMessage, setAdminMessage] = useState('');
  const isAllowed = allowedOrganizationIds.includes(Number(organizationId));
  const isOrgAdmin = (profiles || []).some(
    (profile) => profile.appScope === 'org-app' && profile.role === 'org-admin'
  );

  useEffect(() => {
    if (!organizationId || !isAllowed) {
      setContracts([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .contracts(organizationId, token)
      .then((data) => setContracts(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [organizationId, isAllowed, token]);

  if (!organizationId) {
    return (
      <section className="contracts-center">
        <h2>Contracts</h2>
        <p className="hint">
          Pick an organisation from the top selector to display contracts.
        </p>
      </section>
    );
  }
  if (!isAllowed && !isOrgAdmin) {
    return (
      <section className="contracts-center">
        <h2>Contracts</h2>
        <p className="hint">You are not authorized for the selected organization.</p>
      </section>
    );
  }

  if (error) return <div className="error">Error: {error}</div>;
  if (loading) return <div>Loading…</div>;

  const createContract = async () => {
    const ref = newRef.trim();
    if (!organizationId) {
      setAdminMessage('Select an organization first.');
      return;
    }
    if (!ref) {
      setAdminMessage('Contract reference is required.');
      return;
    }
    setCreatingContract(true);
    setAdminMessage('');
    try {
      const created = await api.createContractAdmin(
        {
          ref,
          user: username || 'org-admin',
          description: newDescription,
          organization: Number(organizationId),
        },
        token
      );
      setContracts((prev) => [created, ...prev]);
      setNewRef('');
      setNewDescription('');
      setAdminMessage(`Contract created: ${created.ref}`);
    } catch (e) {
      setAdminMessage(`Failed to create contract: ${e.message}`);
    } finally {
      setCreatingContract(false);
    }
  };

  const startEditContract = (contract) => {
    setEditingContractId(contract.id);
    setEditingRef(contract.ref || '');
    setAdminMessage('');
  };

  const saveContract = async (contractId) => {
    const ref = editingRef.trim();
    if (!ref) {
      setAdminMessage('Contract ref is required.');
      return;
    }
    setSavingContractId(contractId);
    setAdminMessage('');
    try {
      const updated = await api.updateContractAdmin(contractId, { ref }, token);
      setContracts((prev) => prev.map((item) => (item.id === contractId ? updated : item)));
      setEditingContractId(null);
      setEditingRef('');
      setAdminMessage(`Contract updated: ${updated.ref}`);
    } catch (e) {
      setAdminMessage(`Failed to update contract: ${e.message}`);
    } finally {
      setSavingContractId(null);
    }
  };

  const deleteContract = async (contract) => {
    const confirmed = window.confirm(`Delete contract ${contract.ref}? This cannot be undone.`);
    if (!confirmed) return;
    setDeletingContractId(contract.id);
    setAdminMessage('');
    try {
      await api.deleteContractAdmin(contract.id, token);
      setContracts((prev) => prev.filter((item) => item.id !== contract.id));
      if (editingContractId === contract.id) {
        setEditingContractId(null);
        setEditingRef('');
      }
      setAdminMessage(`Contract deleted: ${contract.ref}`);
    } catch (e) {
      setAdminMessage(`Failed to delete contract: ${e.message}`);
    } finally {
      setDeletingContractId(null);
    }
  };

  return (
    <section className="contracts-center">
      <div className="contracts-header">
        <h2>Contracts</h2>
        <span className="contracts-count">{contracts.length} total</span>
      </div>
      <p className="contracts-subtitle">Showing contracts for organisation #{organizationId}</p>
      {isOrgAdmin && !isAllowed ? (
        <p className="hint">
          Admin mode enabled: creation is available for this organization even if app-surface
          contract listing is restricted by your current context.
        </p>
      ) : null}
      {isOrgAdmin ? (
        <section className="admin-panel">
          <h3>Create contract (org-admin)</h3>
          <p>
            <label htmlFor="new-contract-ref">Ref</label>
            <input
              id="new-contract-ref"
              value={newRef}
              onChange={(e) => setNewRef(e.target.value)}
              placeholder="e.g. ORG-001-C-01"
            />
          </p>
          <p>
            <label htmlFor="new-contract-description">Description</label>
            <input
              id="new-contract-description"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Optional description"
            />
          </p>
          <p>
            <button type="button" onClick={createContract} disabled={creatingContract}>
              {creatingContract ? 'Creating…' : 'Create contract'}
            </button>
          </p>
          {adminMessage ? <p className="hint">{adminMessage}</p> : null}
        </section>
      ) : null}
      {contracts.length === 0 ? (
        <p className="hint">No contracts in this organisation.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ref</th>
                <th>Created</th>
                <th>User</th>
                <th>Description</th>
                {isOrgAdmin ? <th>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <tr key={c.id}>
                  <td>
                    {isOrgAdmin && editingContractId === c.id ? (
                      <input
                        value={editingRef}
                        onChange={(e) => setEditingRef(e.target.value)}
                        className="inline-input"
                      />
                    ) : (
                      <Link to={String(c.id)}>{c.ref}</Link>
                    )}
                  </td>
                  <td>{c.creation_date}</td>
                  <td>{c.user}</td>
                  <td>{c.description}</td>
                  {isOrgAdmin ? (
                    <td className="row-actions">
                      {editingContractId === c.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => saveContract(c.id)}
                            disabled={savingContractId === c.id}
                          >
                            {savingContractId === c.id ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingContractId(null);
                              setEditingRef('');
                            }}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => startEditContract(c)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteContract(c)}
                            disabled={deletingContractId === c.id}
                            className="danger"
                          >
                            {deletingContractId === c.id ? 'Deleting…' : 'Delete'}
                          </button>
                        </>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

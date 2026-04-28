import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';

export default function ContractDetailPage({ organizationId, allowedOrganizationIds, token }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [contract, setContract] = useState(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const isAllowed = allowedOrganizationIds.includes(Number(organizationId));

  useEffect(() => {
    if (!organizationId || !isAllowed) {
      setContract(null);
      setDraft('');
      setError(null);
      return;
    }
    api
      .contract(id, organizationId, token)
      .then((c) => {
        setContract(c);
        setDraft(c.description);
      })
      .catch((e) => setError(e.message));
  }, [id, organizationId, isAllowed, token]);

  if (!organizationId) {
    return (
      <section>
        <h2>Contract details</h2>
        <p className="hint">Select an organisation first before opening a contract.</p>
      </section>
    );
  }
  if (!isAllowed) {
    return (
      <section>
        <h2>Contract details</h2>
        <p className="hint">You are not authorized for the selected organization.</p>
      </section>
    );
  }

  if (error) return <div className="error">Error: {error}</div>;
  if (!contract) return <div>Loading…</div>;

  const dirty = draft !== contract.description;

  const save = async () => {
    setSaving(true);
    try {
      const updated = await api.updateContract(id, { description: draft }, organizationId, token);
      setContract(updated);
      setDraft(updated.description);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <button type="button" onClick={() => navigate(-1)}>
        ← Back
      </button>
      <h2>Contract {contract.ref}</h2>
      <dl>
        <dt>Created</dt>
        <dd>{contract.creation_date}</dd>
        <dt>User</dt>
        <dd>{contract.user}</dd>
        <dt>Organisation</dt>
        <dd>{contract.organization ?? <em>(detached)</em>}</dd>
      </dl>
      <h3>Description</h3>
      <textarea
        value={draft}
        rows={6}
        onChange={(e) => setDraft(e.target.value)}
      />
      <p>
        <button type="button" onClick={save} disabled={saving || !dirty}>
          {saving ? 'Saving…' : 'Save description'}
        </button>
      </p>
    </section>
  );
}

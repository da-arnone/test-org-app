import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api';

function toList(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.results)) return payload.results;
  return [];
}

export default function ProvidersPage({ organizationId, allowedOrganizationIds, token }) {
  const [providers, setProviders] = useState([]);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [providerDetail, setProviderDetail] = useState(null);
  const [forms, setForms] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [subscriptionRequests, setSubscriptionRequests] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [loadingProviderData, setLoadingProviderData] = useState(false);
  const [submittingSubscription, setSubmittingSubscription] = useState(false);
  const [error, setError] = useState(null);

  const isAllowed = allowedOrganizationIds.includes(Number(organizationId));

  useEffect(() => {
    if (!organizationId || !isAllowed) {
      setProviders([]);
      setSelectedProviderId('');
      setProviderDetail(null);
      setForms([]);
      setAnswers([]);
      setSubscriptionRequests([]);
      setError(null);
      setLoadingProviders(false);
      return;
    }

    setLoadingProviders(true);
    setError(null);
    api
      .providers(organizationId, token)
      .then((data) => {
        const list = toList(data);
        setProviders(list);
        if (list.length === 0) {
          setSelectedProviderId('');
          return;
        }
        setSelectedProviderId((current) => {
          if (current && list.some((entry) => String(entry.id) === String(current))) {
            return current;
          }
          return String(list[0].id);
        });
      })
      .catch((e) => {
        setProviders([]);
        setSelectedProviderId('');
        setError(e.message);
      })
      .finally(() => setLoadingProviders(false));
  }, [organizationId, isAllowed, token]);

  useEffect(() => {
    if (!organizationId || !selectedProviderId || !isAllowed) {
      setProviderDetail(null);
      setForms([]);
      setAnswers([]);
      setLoadingProviderData(false);
      return;
    }

    setLoadingProviderData(true);
    setError(null);
    Promise.all([
      api.provider(selectedProviderId, organizationId, token),
      api.providerForms(selectedProviderId, organizationId, token),
      api.providerAnswers(selectedProviderId, organizationId, token),
      api.subscriptionRequests(organizationId, token),
    ])
      .then(([detailData, formsData, answersData, requestsData]) => {
        setProviderDetail(detailData);
        setForms(toList(formsData));
        setAnswers(toList(answersData));
        setSubscriptionRequests(toList(requestsData));
      })
      .catch((e) => {
        setProviderDetail(null);
        setForms([]);
        setAnswers([]);
        setSubscriptionRequests([]);
        setError(e.message);
      })
      .finally(() => setLoadingProviderData(false));
  }, [organizationId, selectedProviderId, isAllowed, token]);

  const selectedProviderPrivateSummary = providerDetail?.private_data_summary || {};
  const hasPrivateData = Boolean(selectedProviderPrivateSummary?.has_private_data);
  const privateAccessGranted = Boolean(providerDetail?.private_access_granted);

  const providerRequest = useMemo(() => {
    const providerId = Number(selectedProviderId);
    if (!providerId) return null;
    return (
      subscriptionRequests.find((entry) => Number(entry.provider_id) === providerId) ||
      subscriptionRequests.find((entry) => Number(entry.submitee_entity_id) === providerId) ||
      null
    );
  }, [selectedProviderId, subscriptionRequests]);

  const subscriptionStatus = providerRequest?.status;
  const isApprovedRequest = String(subscriptionStatus || '').toLowerCase() === 'approved';
  const hasPendingRequest = String(subscriptionStatus || '').toLowerCase() === 'pending';
  const effectivePrivateAccessGranted = privateAccessGranted || isApprovedRequest;
  const canSubscribe = Boolean(selectedProviderId) && hasPrivateData && !effectivePrivateAccessGranted;
  const sortedSubscriptionRequests = useMemo(
    () =>
      [...subscriptionRequests].sort((a, b) => {
        const aDate = new Date(a.created_at || a.createdAt || 0).getTime();
        const bDate = new Date(b.created_at || b.createdAt || 0).getTime();
        return bDate - aDate;
      }),
    [subscriptionRequests]
  );
  const resolveRequestProviderId = (entry) =>
    entry?.provider_id ?? entry?.submitee_entity_id ?? entry?.submiteeId ?? null;
  const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString();
  };

  const onSubscribe = async () => {
    if (!selectedProviderId || submittingSubscription || hasPendingRequest) return;
    setSubmittingSubscription(true);
    setError(null);
    try {
      await api.createSubscriptionRequest(
        { provider_id: Number(selectedProviderId) },
        organizationId,
        token
      );
      const refreshedRequests = await api.subscriptionRequests(organizationId, token);
      setSubscriptionRequests(toList(refreshedRequests));
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmittingSubscription(false);
    }
  };

  const sortedProviders = useMemo(
    () =>
      [...providers].sort((a, b) =>
        String(a.name || a.display_name || '').localeCompare(String(b.name || b.display_name || ''))
      ),
    [providers]
  );

  if (!organizationId) {
    return (
      <section className="contracts-center">
        <h2>Providers</h2>
        <p className="hint">Pick an organisation from the top selector to consult providers.</p>
      </section>
    );
  }

  if (!isAllowed) {
    return (
      <section className="contracts-center">
        <h2>Providers</h2>
        <p className="hint">You are not authorized for the selected organization.</p>
      </section>
    );
  }

  if (error) return <div className="error">Error: {error}</div>;
  if (loadingProviders) return <div>Loading providers…</div>;

  return (
    <section className="contracts-center">
      <div className="contracts-header">
        <h2>Providers</h2>
        <span className="contracts-count">{providers.length} public providers</span>
      </div>
      <p className="contracts-subtitle">Read-only provider consultation via provider-app.</p>
      {sortedProviders.length === 0 ? (
        <p className="hint">No public providers are available.</p>
      ) : (
        <>
          <p>
            <label htmlFor="provider-select">Provider</label>
            <select
              id="provider-select"
              value={selectedProviderId}
              onChange={(e) => setSelectedProviderId(e.target.value)}
            >
              {sortedProviders.map((provider) => (
                <option key={provider.id} value={String(provider.id)}>
                  {provider.name || provider.display_name || `Provider #${provider.id}`}
                </option>
              ))}
            </select>
          </p>
          {loadingProviderData ? <div>Loading provider details…</div> : null}
          {providerDetail ? (
            <section>
              <h3>{providerDetail.name || providerDetail.display_name || `Provider #${providerDetail.id}`}</h3>
              <p className="hint">Public provider profile information.</p>
              {hasPrivateData ? (
                <p>
                  Private questions: <strong>{selectedProviderPrivateSummary.private_question_count || 0}</strong>{' '}
                  {effectivePrivateAccessGranted ? (
                    <span className="hint">- access granted</span>
                  ) : hasPendingRequest ? (
                    <span className="hint">- subscription request pending</span>
                  ) : (
                    <button
                      type="button"
                      onClick={onSubscribe}
                      disabled={submittingSubscription || !canSubscribe}
                    >
                      {submittingSubscription ? 'Submitting...' : 'Subscribe'}
                    </button>
                  )}
                </p>
              ) : null}
              <pre>{JSON.stringify(providerDetail, null, 2)}</pre>
            </section>
          ) : null}

          <section>
            <h3>Public forms</h3>
            {forms.length === 0 ? (
              <p className="hint">No public forms for this provider.</p>
            ) : (
              <pre>{JSON.stringify(forms, null, 2)}</pre>
            )}
          </section>

          <section>
            <h3>Provider answers</h3>
            {answers.length === 0 ? (
              <p className="hint">No answers returned for this provider.</p>
            ) : (
              <pre>{JSON.stringify(answers, null, 2)}</pre>
            )}
          </section>

          <section>
            <h3>Subscription requests</h3>
            {sortedSubscriptionRequests.length === 0 ? (
              <p className="hint">No requests submitted for this organisation.</p>
            ) : (
              <>
                {providerRequest ? (
                  <p className="hint">
                    Current provider request status:{' '}
                    <strong>{providerRequest.status || 'unknown'}</strong>
                  </p>
                ) : (
                  <p className="hint">No request found for the selected provider.</p>
                )}
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Request</th>
                        <th>Provider</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th>Reason</th>
                        <th>Requested fields</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedSubscriptionRequests.map((entry) => {
                        const requestId = entry.id || entry.request_id || '-';
                        const providerId = resolveRequestProviderId(entry);
                        const reason = entry.reason || '-';
                        const requestedFields = Array.isArray(entry.requested_private_fields)
                          ? entry.requested_private_fields
                          : [];
                        return (
                          <tr
                            key={String(requestId)}
                            className={
                              Number(providerId) === Number(selectedProviderId) ? 'row-selected' : ''
                            }
                          >
                            <td>{requestId}</td>
                            <td>{providerId || '-'}</td>
                            <td>{entry.status || 'unknown'}</td>
                            <td>{formatDate(entry.created_at || entry.createdAt)}</td>
                            <td>{reason}</td>
                            <td>{requestedFields.length > 0 ? requestedFields.join(', ') : '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </>
      )}
    </section>
  );
}

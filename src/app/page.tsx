'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Invoice } from '@/domain/invoice';

interface StoredSession {
  token: string;
  username: string;
  role: string;
}

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default function Home() {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [activeTab, setActiveTab] = useState<'invoices' | 'approvals'>('invoices');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loginError, setLoginError] = useState('');
  const [createError, setCreateError] = useState('');
  const [decisionError, setDecisionError] = useState('');

  // Form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [amount, setAmount] = useState('');
  const [rejectionReasons, setRejectionReasons] = useState<{ [id: string]: string }>({});

  const api = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...((options.headers as Record<string, string>) || {}),
      };
      if (session) {
        headers.Authorization = `Bearer ${session.token}`;
      }
      const response = await fetch(`/api${path}`, { ...options, headers });
      if (response.status === 401 && session) {
        signOut();
        throw new Error('Session expired.');
      }
      const body = response.status === 204 ? null : await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error((body && body.error) || `Request failed (${response.status})`);
      }
      return body;
    },
    [session]
  );

  const refresh = useCallback(async () => {
    try {
      const data = await api('/invoices');
      setInvoices(data);
    } catch (err: any) {
      console.error('Failed to load invoices:', err);
    }
  }, [api]);

  useEffect(() => {
    const raw = sessionStorage.getItem('session');
    if (raw) {
      try {
        setSession(JSON.parse(raw));
      } catch {
        sessionStorage.removeItem('session');
      }
    }
  }, []);

  useEffect(() => {
    if (session) {
      refresh();
    }
  }, [session, refresh]);

  const signOut = () => {
    if (session) {
      api('/auth/logout', { method: 'POST' }).catch(() => {});
    }
    setSession(null);
    sessionStorage.removeItem('session');
    setInvoices([]);
    setActiveTab('invoices');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const result = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      const newSession: StoredSession = {
        token: result.token,
        username: result.username,
        role: result.role,
      };
      setSession(newSession);
      sessionStorage.setItem('session', JSON.stringify(newSession));
      setPassword('');
    } catch (error: any) {
      setLoginError(error.message);
    }
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    try {
      await api('/invoices', {
        method: 'POST',
        body: JSON.stringify({ customerName, amount: Number(amount) }),
      });
      setCustomerName('');
      setAmount('');
      refresh();
    } catch (error: any) {
      setCreateError(error.message);
    }
  };

  const handleSubmitDraft = async (invoiceId: string) => {
    try {
      await api(`/invoices/${invoiceId}/submit`, { method: 'POST' });
      refresh();
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleApprove = async (invoiceId: string) => {
    setDecisionError('');
    try {
      await api(`/approvals/${invoiceId}/approve`, { method: 'POST', body: JSON.stringify({}) });
      refresh();
    } catch (error: any) {
      setDecisionError(error.message);
    }
  };

  const handleReject = async (invoiceId: string) => {
    setDecisionError('');
    try {
      const reason = rejectionReasons[invoiceId] || '';
      await api(`/approvals/${invoiceId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      setRejectionReasons(prev => ({ ...prev, [invoiceId]: '' }));
      refresh();
    } catch (error: any) {
      setDecisionError(error.message);
    }
  };

  const pendingInvoices = invoices.filter(i => i.status === 'PendingApproval');

  return (
    <>
      <header>
        <h1>Invoice Approvals</h1>
        {session && (
          <div id="session-bar">
            <span id="whoami">{`${session.username} (${session.role})`}</span>
            <button id="sign-out" type="button" onClick={signOut}>
              Sign out
            </button>
          </div>
        )}
      </header>

      <main>
        {!session ? (
          <section id="login-view" aria-labelledby="login-title">
            <h2 id="login-title">Sign in</h2>
            <form id="login-form" onSubmit={handleLogin}>
              <label htmlFor="username">Username</label>
              <input
                id="username"
                name="username"
                autoComplete="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
              />

              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />

              <button type="submit">Sign in</button>
              {loginError && (
                <p id="login-error" role="alert">
                  {loginError}
                </p>
              )}
            </form>
          </section>
        ) : (
          <section id="app-view">
            <div role="tablist" aria-label="Sections">
              <button
                role="tab"
                id="tab-invoices"
                aria-selected={activeTab === 'invoices'}
                aria-controls="invoices-panel"
                type="button"
                onClick={() => setActiveTab('invoices')}
              >
                Invoices
              </button>
              <button
                role="tab"
                id="tab-approvals"
                aria-selected={activeTab === 'approvals'}
                aria-controls="approvals-panel"
                type="button"
                onClick={() => setActiveTab('approvals')}
              >
                Approvals
              </button>
            </div>

            <section
              id="invoices-panel"
              role="tabpanel"
              aria-labelledby="tab-invoices"
              hidden={activeTab !== 'invoices'}
            >
              <h2>Invoices</h2>

              <form id="new-invoice-form" onSubmit={handleCreateInvoice}>
                <h3>New invoice</h3>
                <label htmlFor="customer">Customer name</label>
                <input
                  id="customer"
                  name="customer"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  required
                />

                <label htmlFor="amount">Amount</label>
                <input
                  id="amount"
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  required
                />

                <button type="submit">Create invoice</button>
                {createError && (
                  <p id="create-error" role="alert">
                    {createError}
                  </p>
                )}
              </form>

              <table id="invoices-table">
                <caption>All invoices</caption>
                <thead>
                  <tr>
                    <th scope="col">ID</th>
                    <th scope="col">Customer</th>
                    <th scope="col">Amount</th>
                    <th scope="col">Status</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(invoice => (
                    <tr key={invoice.id}>
                      <td>{invoice.id}</td>
                      <td>{invoice.customerName}</td>
                      <td>{money.format(invoice.amount)}</td>
                      <td className={`status status-${invoice.status}`}>
                        {invoice.status.replace(/([a-z])([A-Z])/g, '$1 $2')}
                      </td>
                      <td>
                        {invoice.status === 'Draft' && (
                          <button
                            type="button"
                            className="secondary"
                            aria-label={`Submit invoice ${invoice.id} for approval`}
                            onClick={() => handleSubmitDraft(invoice.id)}
                          >
                            Submit for approval
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section
              id="approvals-panel"
              role="tabpanel"
              aria-labelledby="tab-approvals"
              hidden={activeTab !== 'approvals'}
            >
              <h2>Pending approvals</h2>
              {pendingInvoices.length === 0 ? (
                <p id="pending-empty">Nothing is waiting for approval.</p>
              ) : (
                <ul id="pending-list">
                  {pendingInvoices.map(invoice => (
                    <li key={invoice.id}>
                      <span>
                        {`${invoice.id} · ${invoice.customerName} · ${money.format(invoice.amount)}`}
                      </span>
                      <span>
                        <button
                          type="button"
                          aria-label={`Approve invoice ${invoice.id}`}
                          onClick={() => handleApprove(invoice.id)}
                        >
                          Approve
                        </button>
                      </span>
                      <div className="reject-row">
                        <input
                          id={`reason-${invoice.id}`}
                          aria-label={`Rejection reason for ${invoice.id}`}
                          placeholder="Reason (required to reject)"
                          value={rejectionReasons[invoice.id] || ''}
                          onChange={e =>
                            setRejectionReasons(prev => ({
                              ...prev,
                              [invoice.id]: e.target.value,
                            }))
                          }
                        />
                        <button
                          type="button"
                          className="danger"
                          aria-label={`Reject invoice ${invoice.id}`}
                          onClick={() => handleReject(invoice.id)}
                        >
                          Reject
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {decisionError && (
                <p id="decision-error" role="alert">
                  {decisionError}
                </p>
              )}
            </section>
          </section>
        )}
      </main>
    </>
  );
}

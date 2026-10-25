'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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

  const customerInputRef = useRef<HTMLInputElement>(null);

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
      api('/auth/logout', { method: 'POST' }).catch(() => { });
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

  const focusNewInvoiceForm = () => {
    setActiveTab('invoices');
    setTimeout(() => {
      customerInputRef.current?.focus();
      customerInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  const pendingInvoices = invoices.filter(i => i.status === 'PendingApproval');
  const approvedInvoices = invoices.filter(i => i.status === 'Approved');
  const totalVolume = invoices.reduce((acc, inv) => acc + (inv.amount || 0), 0);
  const pendingVolume = pendingInvoices.reduce((acc, inv) => acc + (inv.amount || 0), 0);
  const approvedVolume = approvedInvoices.reduce((acc, inv) => acc + (inv.amount || 0), 0);

  // Format display greeting name
  const displayName = session?.username
    ? session.username.split('.')[0].charAt(0).toUpperCase() + session.username.split('.')[0].slice(1)
    : 'Martin';

  return (
    <>
      {/* 3D Decorative Floating Shapes in Background */}
      <div className="bg-decorations" aria-hidden="true">
        <div className="decor-torus-left" />
        <div className="decor-sphere-left" />
        <div className="decor-torus-right" />
        <div className="decor-crystal-right" />
      </div>

      <div className="app-wrapper">
        {!session ? (
          <section id="login-view" aria-labelledby="login-title">
            <div className="login-brand-header">
              <div className="login-brand-logo">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
              <h2 id="login-title">Sign in</h2>
              <p className="login-subtitle">Invoice Approvals Management Portal</p>
            </div>

            <form id="login-form" onSubmit={handleLogin}>
              <div className="form-field-group">
                <label htmlFor="username">Username</label>
                <input
                  id="username"
                  name="username"
                  autoComplete="username"
                  placeholder="e.g. demo.approver"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                />
              </div>

              <div className="form-field-group">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>

              <button type="submit">Sign in</button>
              {loginError && (
                <p id="login-error" role="alert">
                  {loginError}
                </p>
              )}
            </form>

            <div className="demo-account-pills">
              <div className="demo-pills-label">Quick Sign-in (Demo Accounts)</div>
              <div className="demo-pill-btn-group">
                <button
                  type="button"
                  className="demo-chip"
                  onClick={() => {
                    setUsername('demo.approver');
                    setPassword('ChangeMe123!');
                  }}
                >
                  Approver Demo
                </button>
                <button
                  type="button"
                  className="demo-chip"
                  onClick={() => {
                    setUsername('demo.admin');
                    setPassword('ChangeMe123!');
                  }}
                >
                  Admin Demo
                </button>
              </div>
            </div>
          </section>
        ) : (
          <div className="dashboard-frame">
            {/* Header: Brand & Tabs grouped together on left to remove gap */}
            <header className="app-header">
              <div className="header-left">
                <div className="brand-section">
                  <div className="brand-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                  </div>
                  <h1 className="brand-title">Invoice Approvals</h1>
                </div>

                {/* Navigation pill tabs grouped directly with brand */}
                <div className="nav-pill-group" role="tablist" aria-label="Sections">
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
                    Approvals {pendingInvoices.length > 0 && `(${pendingInvoices.length})`}
                  </button>
                </div>
              </div>

              {/* Right profile / session info */}
              <div className="header-actions">
                <div id="session-bar">
                  <div className="user-profile-badge">
                    <div className="user-avatar">
                      {displayName.charAt(0)}
                    </div>
                    <span id="whoami">{`${session.username} (${session.role})`}</span>
                  </div>
                  <button id="sign-out" type="button" onClick={signOut}>
                    Sign out
                  </button>
                </div>
              </div>
            </header>

            {/* Greeting Hero row */}
            <div className="hero-greeting">
              <div className="greeting-text">
                <h2 className="hero-title">Hello {displayName}!</h2>
                <p className="greeting-subtitle">Welcome to your overview of your account..</p>
              </div>
              <div className="greeting-actions">
                <button type="button" className="btn-launch-primary" onClick={focusNewInvoiceForm}>
                  <span>+ New Invoice</span>
                </button>
              </div>
            </div>

            {/* Relevant Invoice Overview Metrics Cards Row */}
            <div className="products-section">
              <div className="products-section-header">
                <h3 className="products-section-title">Invoice Overview</h3>
              </div>

              <div className="product-cards-grid">
                {/* Card 1: Lavender - Total Invoices */}
                <div className="product-card product-card-lavender" onClick={() => setActiveTab('invoices')}>
                  <div className="card-preview">
                    <div className="card-metric-tag">Total Invoices</div>
                    <div className="card-metric-value">{invoices.length}</div>
                    <div className="card-metric-sub">{money.format(totalVolume)} total volume</div>
                  </div>
                  <div className="card-footer">
                    <div className="card-footer-sub">All transactions &rsaquo;</div>
                    <div className="card-footer-title">All Invoices</div>
                  </div>
                </div>

                {/* Card 2: Dark Navy - Pending Approvals */}
                <div className="product-card product-card-dark" onClick={() => setActiveTab('approvals')}>
                  <div className="card-preview">
                    <div className="card-metric-tag">Needs Review</div>
                    <div className="card-metric-value">{pendingInvoices.length} Pending</div>
                    <div className="card-metric-sub">{money.format(pendingVolume)} awaiting action</div>
                  </div>
                  <div className="card-footer">
                    <div className="card-footer-sub">Approval queue &rsaquo;</div>
                    <div className="card-footer-title">Pending Approvals</div>
                  </div>
                </div>

                {/* Card 3: Pink - Approved Invoices */}
                <div className="product-card product-card-pink" onClick={() => setActiveTab('invoices')}>
                  <div className="card-preview">
                    <div className="card-metric-tag">Approved</div>
                    <div className="card-metric-value">{approvedInvoices.length} Settled</div>
                    <div className="card-metric-sub">{money.format(approvedVolume)} approved volume</div>
                  </div>
                  <div className="card-footer">
                    <div className="card-footer-sub">Settled invoices &rsaquo;</div>
                    <div className="card-footer-title">Approved Invoices</div>
                  </div>
                </div>

                {/* Card 4: Cobalt Blue - Quick Action */}
                <div className="product-card product-card-blue">
                  <div className="blue-card-inner">
                    <div>
                      <h4 className="blue-card-title">New Invoice</h4>
                      <p className="blue-card-desc">Draft and submit a new invoice for approval review.</p>
                    </div>
                    <button type="button" className="btn-add-new-card" onClick={focusNewInvoiceForm}>
                      <span>+ Add new</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Application Views: Invoicing and Approvals */}
            <section id="app-view">
              {/* Invoices Tab Panel */}
              <section
                id="invoices-panel"
                role="tabpanel"
                aria-labelledby="tab-invoices"
                hidden={activeTab !== 'invoices'}
              >
                <div className="panel-header-row">
                  <h2 className="panel-heading">Invoices</h2>
                  <span className="section-link">All Records</span>
                </div>

                {/* New Invoice Form */}
                <div className="new-invoice-card">
                  <h3>New invoice</h3>
                  <form id="new-invoice-form" onSubmit={handleCreateInvoice}>
                    <div className="form-field-group">
                      <label htmlFor="customer">Customer name</label>
                      <input
                        ref={customerInputRef}
                        id="customer"
                        name="customer"
                        placeholder="e.g. Acme Corp"
                        value={customerName}
                        onChange={e => setCustomerName(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-field-group">
                      <label htmlFor="amount">Amount</label>
                      <input
                        id="amount"
                        name="amount"
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="0.00"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        required
                      />
                    </div>

                    <button type="submit">Create invoice</button>
                    {createError && (
                      <p id="create-error" role="alert">
                        {createError}
                      </p>
                    )}
                  </form>
                </div>

                {/* Invoices Table */}
                <div className="table-container">
                  <table id="invoices-table">
                    <caption>All invoices</caption>
                    <thead>
                      <tr>
                        <th scope="col">Invoice#</th>
                        <th scope="col">Customer</th>
                        <th scope="col">Amount</th>
                        <th scope="col">Status</th>
                        <th scope="col">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--ink-muted)' }}>
                            No invoices recorded yet. Create your first invoice above!
                          </td>
                        </tr>
                      ) : (
                        invoices.map(invoice => (
                          <tr key={invoice.id}>
                            <td className="invoice-id-cell">{invoice.id}</td>
                            <td>{invoice.customerName}</td>
                            <td className="invoice-amount-cell">{money.format(invoice.amount)}</td>
                            <td>
                              <span className={`status status-${invoice.status}`}>
                                {invoice.status.replace(/([a-z])([A-Z])/g, '$1 $2')}
                              </span>
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
                        ))
                      )}
                    </tbody>
                  </table>

                  {/* Clean Table Footer Closure */}
                  {invoices.length > 0 && (
                    <div className="table-footer-bar">
                      <span>Showing <strong>{invoices.length}</strong> invoices</span>
                      <span>Total Volume: <strong>{money.format(totalVolume)}</strong></span>
                    </div>
                  )}
                </div>
              </section>

              {/* Approvals Tab Panel */}
              <section
                id="approvals-panel"
                role="tabpanel"
                aria-labelledby="tab-approvals"
                hidden={activeTab !== 'approvals'}
              >
                <div className="panel-header-row">
                  <h2 className="panel-heading">Pending approvals</h2>
                  <span className="section-link">{pendingInvoices.length} Waiting</span>
                </div>

                {pendingInvoices.length === 0 ? (
                  <p id="pending-empty">Nothing is waiting for approval.</p>
                ) : (
                  <ul id="pending-list">
                    {pendingInvoices.map(invoice => (
                      <li key={invoice.id}>
                        <div className="pending-invoice-info">
                          <span className="pending-badge">Pending Review</span>
                          <span className="pending-details">
                            {`${invoice.id} · ${invoice.customerName} · ${money.format(invoice.amount)}`}
                          </span>
                        </div>
                        <div className="pending-actions">
                          <button
                            type="button"
                            className="btn-approve"
                            aria-label={`Approve invoice ${invoice.id}`}
                            onClick={() => handleApprove(invoice.id)}
                          >
                            Approve
                          </button>
                        </div>
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

            {/* Dashboard Footer to anchor the card bottom cleanly */}
            <footer className="dashboard-footer">
              <span>Invoice Approvals Demo App</span>
              <span>Session active: <strong>{session.username}</strong></span>
            </footer>
          </div>
        )}
      </div>
    </>
  );
}

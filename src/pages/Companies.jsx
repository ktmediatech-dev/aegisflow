import React, { useEffect, useState } from 'react'
import api from '../services/api.js'
import toast from 'react-hot-toast'
import { ChevronDown, ChevronUp, KeyRound, History } from 'lucide-react'

const PLANS = ['trial', 'enterprise']
const STATUSES = ['active', 'suspended', 'cancelled']

export default function Companies() {
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [companyLoading, setCompanyLoading] = useState(false)
  const [error, setError] = useState(null)
  const [companyForm, setCompanyForm] = useState({ name: '', plan: 'trial', itAdminEmail: '', itAdminName: '', itAdminPassword: '' })
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    loadCompanies()
  }, [])

  const loadCompanies = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.getCompanies()
      setCompanies(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const submitCompany = async (e) => {
    e.preventDefault()
    setCompanyLoading(true)
    setError(null)
    try {
      await api.createCompany(companyForm)
      toast.success(`${companyForm.name} provisioned`)
      setCompanyForm({ name: '', plan: 'trial', itAdminEmail: '', itAdminName: '', itAdminPassword: '' })
      loadCompanies()
    } catch (err) {
      setError(err.message)
      toast.error(err.message)
    } finally {
      setCompanyLoading(false)
    }
  }

  const handleStatusChange = async (company, status) => {
    try {
      await api.updateCompanyStatus(company.id, status)
      toast.success(`${company.name} is now ${status}`)
      loadCompanies()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handlePlanChange = async (company, plan) => {
    try {
      await api.updateCompanyPlan(company.id, plan)
      toast.success(`${company.name} moved to ${plan}`)
      loadCompanies()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="page-card">
      <div className="page-header">
        <div>
          <div className="page-title">Platform Administration</div>
          <div className="page-subtitle">
            Onboard companies, manage their subscription and status, reset a locked-out admin's password, or review their audit trail —
            without ever touching their operational data.
          </div>
        </div>
      </div>

      {error && (
        <div className="alert-bar danger" style={{ marginBottom: 20 }}>
          <div>{error}</div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontWeight: 600 }}>Subscribed companies</div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{companies.length} companies</span>
        </div>
        {loading ? (
          <div style={{ color: 'var(--text-muted)' }}>Loading companies…</div>
        ) : companies.length === 0 ? (
          <div className="empty-state">No companies yet — create the first one below.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => (
                <React.Fragment key={company.id}>
                  <tr>
                    <td style={{ fontWeight: 600 }}>{company.name}</td>
                    <td>
                      <select
                        value={company.plan}
                        onChange={(e) => handlePlanChange(company, e.target.value)}
                        style={{ fontSize: 12, padding: '4px 8px' }}
                      >
                        {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </td>
                    <td>
                      <select
                        value={company.status}
                        onChange={(e) => handleStatusChange(company, e.target.value)}
                        style={{ fontSize: 12, padding: '4px 8px' }}
                      >
                        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td>{new Date(company.created_at).toLocaleDateString()}</td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setExpandedId(expandedId === company.id ? null : company.id)}
                      >
                        Manage {expandedId === company.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                    </td>
                  </tr>
                  {expandedId === company.id && (
                    <tr>
                      <td colSpan={5} style={{ padding: 0 }}>
                        <CompanyManagePanel company={company} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ maxWidth: 520 }}>
        <div className="card-header">
          <div className="card-title">Onboard a new company</div>
        </div>
        <form onSubmit={submitCompany}>
          <div className="form-group">
            <label className="form-label">Company name</label>
            <input
              className="form-input"
              value={companyForm.name}
              onChange={(e) => setCompanyForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="KT-Petroleum"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Subscription plan</label>
            <select
              className="form-input"
              value={companyForm.plan}
              onChange={(e) => setCompanyForm((f) => ({ ...f, plan: e.target.value }))}
            >
              {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">IT Admin email</label>
            <input
              className="form-input"
              type="email"
              value={companyForm.itAdminEmail}
              onChange={(e) => setCompanyForm((f) => ({ ...f, itAdminEmail: e.target.value }))}
              placeholder="admin@company.com"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">IT Admin name</label>
            <input
              className="form-input"
              value={companyForm.itAdminName}
              onChange={(e) => setCompanyForm((f) => ({ ...f, itAdminName: e.target.value }))}
              placeholder="IT Administrator"
            />
          </div>
          <div className="form-group">
            <label className="form-label">IT Admin password</label>
            <input
              className="form-input"
              type="password"
              value={companyForm.itAdminPassword}
              onChange={(e) => setCompanyForm((f) => ({ ...f, itAdminPassword: e.target.value }))}
              placeholder="Create a secure password"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={companyLoading} style={{ width: '100%', justifyContent: 'center' }}>
            {companyLoading ? 'Provisioning company…' : 'Create company'}
          </button>
        </form>
      </div>
    </div>
  )
}

function CompanyManagePanel({ company }) {
  const [tab, setTab] = useState('users')
  const [users, setUsers] = useState(null)
  const [auditLog, setAuditLog] = useState(null)
  const [resetTarget, setResetTarget] = useState(null)
  const [newPassword, setNewPassword] = useState('')

  useEffect(() => {
    if (tab === 'users' && users === null) {
      api.getCompanyUsers(company.id).then(setUsers).catch((err) => toast.error(err.message))
    }
    if (tab === 'audit' && auditLog === null) {
      api.getCompanyAuditLog(company.id).then(setAuditLog).catch((err) => toast.error(err.message))
    }
  }, [tab, company.id, users, auditLog])

  const handleReset = async (user) => {
    if (!newPassword || newPassword.length < 8) {
      toast.error('New password must be at least 8 characters')
      return
    }
    try {
      await api.resetCompanyUserPassword(company.id, user.id, newPassword)
      toast.success(`Password reset for ${user.email}`)
      setResetTarget(null)
      setNewPassword('')
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div style={{ background: 'var(--bg-raised)', padding: 16, borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button className={`btn btn-sm ${tab === 'users' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('users')}>
          <KeyRound size={12} /> Users & Password Reset
        </button>
        <button className={`btn btn-sm ${tab === 'audit' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('audit')}>
          <History size={12} /> Audit Log
        </button>
      </div>

      {tab === 'users' && (
        users === null ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading users…</div>
        ) : users.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No users yet.</div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.role_name || '—'}</td>
                  <td><span className={`badge ${u.status === 'active' ? 'badge-success' : 'badge-muted'}`}>{u.status}</span></td>
                  <td>
                    {resetTarget === u.id ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          type="password" placeholder="New password" value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          style={{ fontSize: 12, padding: '4px 8px', width: 140 }}
                        />
                        <button className="btn btn-primary btn-sm" onClick={() => handleReset(u)}>Save</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setResetTarget(null); setNewPassword('') }}>Cancel</button>
                      </div>
                    ) : (
                      <button className="btn btn-ghost btn-sm" onClick={() => setResetTarget(u.id)}>Reset password</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}

      {tab === 'audit' && (
        auditLog === null ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading audit log…</div>
        ) : auditLog.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No audit entries yet.</div>
        ) : (
          <table className="data-table">
            <thead><tr><th>When</th><th>User</th><th>Action</th><th>Module</th></tr></thead>
            <tbody>
              {auditLog.map((a) => (
                <tr key={a.id}>
                  <td style={{ fontSize: 12 }}>{new Date(a.created_at).toLocaleString()}</td>
                  <td style={{ fontSize: 12 }}>{a.user_email || '—'}</td>
                  <td style={{ fontSize: 12 }}>{a.action}</td>
                  <td style={{ fontSize: 12 }}>{a.module || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </div>
  )
}

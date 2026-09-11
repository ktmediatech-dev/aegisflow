import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()
  const login = useStore(s => s.login)
  const fetchCompanyData = useStore(s => s.fetchCompanyData)

  useEffect(() => {
    const previousTheme = document.documentElement.getAttribute('data-theme') || 'dark'
    document.documentElement.setAttribute('data-theme', 'light')
    return () => {
      document.documentElement.setAttribute('data-theme', previousTheme)
    }
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await login(email, password)
      await fetchCompanyData()
      navigate('/')
    } catch (err) {
      setError(err.message || 'Unable to sign in.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'linear-gradient(180deg, #eff6ff 0%, #f8fafc 100%)' }}>
      <div style={{ width: '100%', maxWidth: 420, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 24, boxShadow: '0 30px 90px rgba(15,23,42,0.08)', overflow: 'hidden' }}>
        <div style={{ padding: '32px 32px 24px', borderBottom: '1px solid rgba(148,163,184,0.16)', display: 'grid', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: '#2563eb', display: 'grid', placeItems: 'center' }}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" fill="#fff" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#ffffff' }}>AegisFlow</div>
              <div style={{ fontSize: 13, color: '#94a3b8' }}>Secure ERP access for KT-Petroleum and company users.</div>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0' }}>Welcome back</div>
            <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>Sign in with your company credentials to continue.</div>
          </div>
        </div>

        <form onSubmit={submit} style={{ padding: '28px 32px 32px', display: 'grid', gap: 18 }}>
          {error && (
            <div style={{ background: 'rgba(248,81,73,0.12)', color: '#f87171', borderRadius: 14, padding: '12px 14px', fontSize: 13 }}>
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email address</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="form-input"
              placeholder="user@democo.local"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="form-input"
              placeholder="Enter your password"
              required
            />
          </div>

          <button className="btn btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '12px 16px', borderRadius: 14 }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, color: '#94a3b8', fontSize: 12 }}>
            <span>Your company will be determined after login.</span>
            <span style={{ color: '#60a5fa' }}>Demo credentials available</span>
          </div>
        </form>
      </div>
    </div>
  )
}

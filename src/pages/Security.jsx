import React, { useEffect, useState } from 'react'
import api from '../services/api.js'
import toast from 'react-hot-toast'
import { ShieldCheck, ShieldOff, Copy } from 'lucide-react'

export default function Security() {
  const [enabled, setEnabled] = useState(null)
  const [enrolling, setEnrolling] = useState(false)
  const [setupData, setSetupData] = useState(null)
  const [code, setCode] = useState('')
  const [backupCodes, setBackupCodes] = useState(null)
  const [disableCode, setDisableCode] = useState('')
  const [showDisable, setShowDisable] = useState(false)
  const [loading, setLoading] = useState(false)

  const loadStatus = () => {
    api.get2FAStatus().then((r) => setEnabled(r.enabled)).catch((err) => toast.error(err.message))
  }

  useEffect(() => { loadStatus() }, [])

  const startEnroll = async () => {
    setLoading(true)
    try {
      const data = await api.setup2FA()
      setSetupData(data)
      setEnrolling(true)
    } catch (err) {
      toast.error(err.message || 'Failed to start 2FA setup')
    } finally {
      setLoading(false)
    }
  }

  const confirmEnroll = async () => {
    if (!code) { toast.error('Enter the code from your authenticator app'); return }
    setLoading(true)
    try {
      const res = await api.verifySetup2FA(code)
      setBackupCodes(res.backupCodes)
      setEnabled(true)
      setEnrolling(false)
      setCode('')
      toast.success('Two-factor authentication enabled')
    } catch (err) {
      toast.error(err.message || 'Invalid code')
    } finally {
      setLoading(false)
    }
  }

  const disable = async () => {
    if (!disableCode) { toast.error('Enter a code to confirm'); return }
    setLoading(true)
    try {
      await api.disable2FA(disableCode)
      setEnabled(false)
      setShowDisable(false)
      setDisableCode('')
      toast.success('Two-factor authentication disabled')
    } catch (err) {
      toast.error(err.message || 'Invalid code')
    } finally {
      setLoading(false)
    }
  }

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'))
    toast.success('Backup codes copied')
  }

  return (
    <div className="page-card">
      <div className="page-header">
        <div>
          <div className="page-title">Security</div>
          <div className="page-subtitle">Two-factor authentication for your platform admin login.</div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 560 }}>
        {enabled === null ? (
          <div style={{ color: 'var(--text-muted)' }}>Loading…</div>
        ) : backupCodes ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: 'var(--success)' }}>
              <ShieldCheck size={18} /> <strong>2FA is now enabled</strong>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
              Save these one-time backup codes somewhere safe — each can be used once to sign in if you lose access to your authenticator app.
              They will not be shown again.
            </div>
            <div style={{ background: 'var(--bg-raised)', borderRadius: 10, padding: 14, fontFamily: 'var(--font-mono)', fontSize: 13, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {backupCodes.map((c) => <div key={c}>{c}</div>)}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button className="btn btn-secondary btn-sm" onClick={copyBackupCodes}><Copy size={13} /> Copy codes</button>
              <button className="btn btn-primary btn-sm" onClick={() => setBackupCodes(null)}>Done</button>
            </div>
          </div>
        ) : enrolling && setupData ? (
          <div>
            <div style={{ fontWeight: 600, marginBottom: 10 }}>Scan this QR code</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
              Use Google Authenticator, Authy, or any TOTP app. Can't scan? Enter this code manually: <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-raised)', padding: '2px 6px', borderRadius: 4 }}>{setupData.secret}</code>
            </div>
            <img src={setupData.qrDataUrl} alt="2FA QR code" style={{ width: 200, height: 200, borderRadius: 10, background: '#fff', padding: 8 }} />
            <div className="form-group" style={{ marginTop: 16, maxWidth: 240 }}>
              <label className="form-label">Enter the 6-digit code to confirm</label>
              <input value={code} onChange={e => setCode(e.target.value)} placeholder="123456" inputMode="numeric" />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => { setEnrolling(false); setSetupData(null) }}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={confirmEnroll} disabled={loading}>{loading ? 'Verifying…' : 'Confirm & Enable'}</button>
            </div>
          </div>
        ) : enabled ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: 'var(--success)' }}>
              <ShieldCheck size={18} /> <strong>Two-factor authentication is enabled</strong>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              You'll be asked for a code from your authenticator app every time you sign in.
            </div>
            {!showDisable ? (
              <button className="btn btn-secondary btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setShowDisable(true)}>
                <ShieldOff size={13} /> Disable 2FA
              </button>
            ) : (
              <div>
                <div className="form-group" style={{ maxWidth: 240 }}>
                  <label className="form-label">Enter a current code to confirm disabling</label>
                  <input value={disableCode} onChange={e => setDisableCode(e.target.value)} placeholder="123456" inputMode="numeric" />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setShowDisable(false); setDisableCode('') }}>Cancel</button>
                  <button className="btn btn-primary btn-sm" style={{ background: 'var(--danger)' }} onClick={disable} disabled={loading}>{loading ? 'Disabling…' : 'Confirm Disable'}</button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: 'var(--warning)' }}>
              <ShieldOff size={18} /> <strong>Two-factor authentication is off</strong>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Your platform admin account currently only requires a password. Enabling 2FA is strongly recommended — this account can create, suspend, or reset the password of any company.
            </div>
            <button className="btn btn-primary btn-sm" onClick={startEnroll} disabled={loading}>{loading ? 'Starting…' : 'Enable 2FA'}</button>
          </div>
        )}
      </div>
    </div>
  )
}

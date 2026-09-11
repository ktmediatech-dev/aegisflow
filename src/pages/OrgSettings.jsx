import React, { useState, useEffect } from 'react'
import { useStore } from '../store/useStore.js'
import { useTheme, THEMES } from '../context/ThemeContext.jsx'
import toast from 'react-hot-toast'
import { Upload } from 'lucide-react'

const THEME_LABELS = { dark: 'Dark', light: 'Light', ocean: 'Ocean', forest: 'Forest', sunset: 'Sunset', slate: 'Slate', violet: 'Violet' }
const THEME_SWATCHES = {
  dark: ['#0d1117', '#3d8ef0'], light: ['#f3f6fa', '#2563eb'], ocean: ['#071a24', '#22b8cf'],
  forest: ['#0f1a10', '#4ade80'], sunset: ['#1c1410', '#fb923c'], slate: ['#eef1f5', '#475569'], violet: ['#170f23', '#a78bfa'],
}

export default function OrgSettings() {
  const { settings, updateSettings } = useStore()
  const { setTheme: applyThemeLive } = useTheme()
  const [form, setForm] = useState({ companyName: '', contactEmail: '', theme: 'dark' })
  const [logoDataUri, setLogoDataUri] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (settings) {
      setForm({ companyName: settings.companyName || '', contactEmail: settings.contactEmail || '', theme: settings.theme || 'dark' })
      setLogoDataUri(settings.logoDataUri || null)
    }
  }, [settings])

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 350_000) {
      toast.error('Logo is too large — please use an image under ~350KB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setLogoDataUri(reader.result)
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateSettings({ ...form, logoDataUri })
      applyThemeLive(form.theme) // reflect immediately for this admin, not just future logins
      toast.success('Settings saved')
    } catch (err) {
      toast.error(err.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-card">
      <div className="page-header">
        <div>
          <div className="page-title">Organization Settings</div>
          <div className="page-subtitle">Branding and theme shown across the app for everyone in your company.</div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 560, marginBottom: 20 }}>
        <div className="card-header"><div className="card-title">Branding</div></div>

        <div className="form-group">
          <label className="form-label">Company display name</label>
          <input value={form.companyName} onChange={e => setForm(p => ({...p, companyName: e.target.value}))} placeholder="Shown in the header next to your logo" />
        </div>

        <div className="form-group">
          <label className="form-label">Contact email</label>
          <input type="email" value={form.contactEmail} onChange={e => setForm(p => ({...p, contactEmail: e.target.value}))} placeholder="support@yourcompany.com" />
        </div>

        <div className="form-group">
          <label className="form-label">Logo</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 10, border: '1px dashed var(--border-bright)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: 'var(--bg-raised)',
            }}>
              {logoDataUri ? <img src={logoDataUri} alt="Logo preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <Upload size={18} color="var(--text-muted)" />}
            </div>
            <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
              Choose Image
              <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
            </label>
            {logoDataUri && <button className="btn btn-ghost btn-sm" onClick={() => setLogoDataUri(null)}>Remove</button>}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>PNG or SVG recommended, under ~350KB. Appears next to your company name in the header.</div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 560, marginBottom: 20 }}>
        <div className="card-header"><div className="card-title">Theme</div></div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
          Default theme for everyone in your company. Anyone can still switch their own view from the header — this just sets what new/unset browsers start with.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
          {THEMES.map(t => (
            <button
              key={t}
              onClick={() => setForm(p => ({...p, theme: t}))}
              style={{
                display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', padding: 12,
                borderRadius: 10, cursor: 'pointer',
                border: form.theme === t ? '2px solid var(--accent)' : '1px solid var(--border)',
                background: 'var(--bg-raised)',
              }}
            >
              <div style={{ display: 'flex', width: '100%', height: 28, borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ flex: 1, background: THEME_SWATCHES[t][0] }} />
                <div style={{ flex: 1, background: THEME_SWATCHES[t][1] }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: form.theme === t ? 700 : 500 }}>{THEME_LABELS[t]}</span>
            </button>
          ))}
        </div>
      </div>

      <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save Settings'}
      </button>
    </div>
  )
}

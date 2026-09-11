import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Menu, Bell, Search, ChevronRight, Moon, Sun } from 'lucide-react'
import { useStore } from '../../store/useStore.js'
import { useTheme } from '../../context/ThemeContext.jsx'
import { CURRENCIES } from '../../utils/currency.js'

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/stations': 'Stations',
  '/fleet': 'Fleet Management',
  '/tanks': 'Tanks & Inventory',
  '/maintenance': 'Maintenance',
  '/contractors': 'Contractors',
  '/suppliers': 'Suppliers',
  '/analytics': 'Analytics',
  '/alerts': 'Alerts & Notifications',
  '/fraud': 'Fraud Detection',
  '/import': 'Data Import',
  '/reports': 'Reports',
}

export default function Header() {
  const { toggleSidebar, alerts, currency, setCurrency, user } = useStore()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const [showNotif, setShowNotif] = useState(false)
  const navigate = useNavigate()
  const activeAlerts = alerts.filter(a => a.status === 'active').slice(0, 4)

  const title = PAGE_TITLES[location.pathname] || 'AegisFlow'

  return (
    <header style={{
      height: 'var(--header-height)',
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      gap: 16,
      position: 'sticky',
      top: 0,
      zIndex: 40,
    }}>
      <button onClick={toggleSidebar} className="btn btn-ghost" style={{ padding: 6, borderRadius: 8 }}>
        <Menu size={18} />
      </button>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          {user?.type === 'platform_admin' ? 'Platform Admin' : user?.company || 'AegisFlow'}
        </span>
        <ChevronRight size={12} color="var(--text-muted)" />
        <span style={{ fontWeight: 600, fontSize: 14 }}>{title}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Currency selector */}
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          title="Display currency"
          style={{
            width: 'auto',
            background: 'var(--bg-raised)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '7px 10px',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-primary)',
            cursor: 'pointer',
          }}
        >
          {CURRENCIES.map(c => (
            <option key={c.code} value={c.code}>{c.code} · {c.symbol}</option>
          ))}
        </select>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="btn btn-ghost"
          style={{ padding: 8, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        {/* Notification bell */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowNotif(!showNotif)}
            className="btn btn-ghost"
            style={{ padding: 8, borderRadius: 8, position: 'relative' }}
          >
            <Bell size={17} />
            {activeAlerts.length > 0 && (
              <span style={{
                position: 'absolute', top: 4, right: 4,
                width: 8, height: 8,
                background: 'var(--danger)', borderRadius: '50%',
                border: '1px solid var(--bg-surface)',
              }} />
            )}
          </button>

          {showNotif && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              width: 320, background: 'var(--bg-raised)',
              border: '1px solid var(--border-bright)',
              borderRadius: 12, boxShadow: 'var(--shadow-lg)',
              zIndex: 100,
              overflow: 'hidden',
            }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>Active Alerts</span>
                <button className="btn btn-ghost btn-sm" onClick={() => { navigate('/alerts'); setShowNotif(false) }}>View all</button>
              </div>
              {activeAlerts.map(alert => (
                <div key={alert.id} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                  onClick={() => { navigate('/alerts'); setShowNotif(false) }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: alert.severity === 'critical' ? 'var(--danger)' : alert.severity === 'warning' ? 'var(--warning)' : 'var(--info)', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{alert.title}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alert.message}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showNotif && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setShowNotif(false)} />
      )}
    </header>
  )
}

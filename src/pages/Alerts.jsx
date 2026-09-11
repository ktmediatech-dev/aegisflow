import React, { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { AlertTriangle, Bell, CheckCircle, XCircle, Filter } from 'lucide-react'
import toast from 'react-hot-toast'

const SEVERITY_STYLE = {
  critical: { cls: 'critical', color: 'var(--danger)' },
  high:     { cls: 'critical', color: 'var(--danger)' },
  warning:  { cls: 'warning',  color: 'var(--warning)' },
  info:     { cls: 'info',     color: 'var(--accent)' },
}

export default function Alerts() {
  const { alerts, acknowledgeAlert, dismissAlert } = useStore()
  const [filter, setFilter] = useState('active')

  const filtered = alerts.filter(a => filter === 'all' ? true : a.status === filter)
  const counts = {
    active: alerts.filter(a => a.status === 'active').length,
    acknowledged: alerts.filter(a => a.status === 'acknowledged').length,
    critical: alerts.filter(a => a.status === 'active' && (a.severity === 'critical' || a.severity === 'high')).length,
  }

  const handleAck = async (id) => {
    try {
      await acknowledgeAlert(id)
      toast.success('Alert acknowledged')
    } catch (err) {
      toast.error(err.message || 'Failed to acknowledge alert')
    }
  }
  const handleDismiss = async (id) => {
    try {
      await dismissAlert(id)
      toast.success('Alert dismissed')
    } catch (err) {
      toast.error(err.message || 'Failed to dismiss alert')
    }
  }

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <div className="page-title">Alerts & Notifications</div>
          <div className="page-subtitle">{counts.active} active · {counts.critical} critical/high</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['active', 'acknowledged', 'all'].map(f => (
            <button
              key={f}
              className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter(f)}
              style={{ textTransform: 'capitalize' }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-label">Active Alerts</div>
          <div className="stat-value">{counts.active}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Critical / High</div>
          <div className="stat-value" style={{ color: 'var(--danger)' }}>{counts.critical}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Acknowledged</div>
          <div className="stat-value" style={{ color: 'var(--text-secondary)' }}>{counts.acknowledged}</div>
        </div>
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <CheckCircle size={32} />
            <div>No {filter !== 'all' ? filter : ''} alerts</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(alert => {
              const sev = SEVERITY_STYLE[alert.severity] || SEVERITY_STYLE.info
              return (
                <div key={alert.id} className={`alert-bar ${sev.cls}`}>
                  <AlertTriangle size={18} color={sev.color} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 13 }}>{alert.title}</strong>
                      <span className={`badge badge-${alert.severity === 'critical' || alert.severity === 'high' ? 'danger' : alert.severity === 'warning' ? 'warning' : 'info'}`}>
                        {alert.severity}
                      </span>
                      {alert.station && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {alert.station}</span>}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>{alert.message}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {alert.date}{alert.assignedTo ? ` · Assigned: ${alert.assignedTo}` : ''}
                    </div>
                  </div>
                  {alert.status === 'active' && (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleAck(alert.id)}>Acknowledge</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDismiss(alert.id)}>Dismiss</button>
                    </div>
                  )}
                  {alert.status === 'acknowledged' && (
                    <span className="badge badge-neutral" style={{ flexShrink: 0 }}>Acknowledged</span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine
} from 'recharts'
import { useStore } from '../store/useStore.js'
import { formatCurrency } from '../utils/currency.js'
import { Fuel, Truck, AlertTriangle, TrendingUp, ShieldAlert, Wrench, Users } from 'lucide-react'

export default function Dashboard() {
  const { stations, fleet, alerts, maintenanceJobs, tankReadings, chartData, currency, user } = useStore()
  const navigate = useNavigate()
  const fmtKES = (v) => formatCurrency(v, currency)

  const hasPermission = (moduleKey) => {
    if (!user) return false
    if (user.type === 'platform_admin') return true
    return !!user.permissions?.some((perm) => perm.module === moduleKey && perm.can_read)
  }

  const operationalStations = stations.filter(s => s.status === 'operational').length
  const vehiclesInTransit = fleet.filter(v => v.status === 'in-transit').length
  const activeAlerts = alerts.filter(a => a.status === 'active').length
  const criticalAlerts = alerts.filter(a => a.severity === 'critical' && a.status === 'active').length
  const overdueJobs = maintenanceJobs.filter(j => j.status === 'overdue').length
  const anomalyTanks = tankReadings.filter(t => t.status === 'anomaly').length
  const totalMonthlySales = stations.reduce((s, st) => s + st.monthlySales, 0)

  const cards = []
  if (hasPermission('stations')) {
    cards.push({ icon: <Fuel size={18} />, label: 'Stations Active', value: `${operationalStations}/${stations.length}`, help: 'Operational stations', color: 'var(--accent)' })
  }
  if (hasPermission('fleet')) {
    cards.push({ icon: <Truck size={18} />, label: 'Vehicles in Transit', value: vehiclesInTransit, help: `${fleet.length} total`, color: 'var(--success)' })
  }
  if (hasPermission('maintenance')) {
    cards.push({ icon: <Wrench size={18} />, label: 'Overdue Maintenance', value: overdueJobs, help: `${maintenanceJobs.filter(j => j.status === 'in-progress').length} in progress`, color: 'var(--warning)' })
  }
  if (hasPermission('compliance')) {
    cards.push({ icon: <ShieldAlert size={18} />, label: 'Active Alerts', value: activeAlerts, help: `${criticalAlerts} critical`, color: 'var(--danger)' })
  }
  if (hasPermission('finance') || hasPermission('procurement')) {
    cards.push({ icon: <TrendingUp size={18} />, label: 'Estimated Monthly Revenue', value: fmtKES(totalMonthlySales), help: 'Data from sales and procurement', color: 'var(--info)' })
  }
  if (hasPermission('hr')) {
    cards.push({ icon: <Users size={18} />, label: 'Employees tracked', value: `${tankReadings.length} records`, help: 'HR headcount and staffing', color: 'var(--accent-dim)' })
  }

  const showSalesChart = hasPermission('finance') || hasPermission('procurement') || hasPermission('analytics')
  const showStationChart = hasPermission('stations') || hasPermission('fleet') || hasPermission('analytics')
  const showRecentAlerts = hasPermission('dashboard') || hasPermission('compliance') || hasPermission('analytics')
  const showFleetSummary = hasPermission('fleet') || hasPermission('analytics')
  const showEmptyDashboardState = !showSalesChart && !showStationChart && !showRecentAlerts && !showFleetSummary

  return (
    <div className="animate-fadeIn">
      {/* Critical alert banner */}
      {criticalAlerts > 0 && (
        <div className="alert-bar danger" style={{ marginBottom: 20, cursor: 'pointer' }} onClick={() => navigate('/alerts')}>
          <AlertTriangle size={16} />
          <strong>{criticalAlerts} critical alert{criticalAlerts > 1 ? 's' : ''} require{criticalAlerts === 1 ? 's' : ''} immediate attention.</strong>
          <span style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.8 }}>View Alerts →</span>
        </div>
      )}

      <div className="page-header">
        <div>
          <div className="page-title">Network Dashboard</div>
          <div className="page-subtitle">Real-time overview · {new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {hasPermission('analytics') && (
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/analytics')}>Full Analytics</button>
          )}
          {hasPermission('reports') && (
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/reports')}>Generate Report</button>
          )}
        </div>
      </div>

      {/* KPI cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: 24 }}>
        {cards.length > 0 ? cards.map((card) => (
          <StatCard
            key={card.label}
            icon={card.icon}
            iconBg={card.color === 'var(--accent)' ? 'var(--accent-dim)' : 'rgba(255,255,255,0.08)'}
            iconColor={card.color}
            label={card.label}
            value={card.value}
            change={card.help}
            changeGood={card.color === 'var(--success)' || card.color === 'var(--accent)'}
          />
        )) : (
          <div className="card" style={{ padding: 24, width: '100%' }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Welcome to your dashboard</div>
            <div style={{ color: 'var(--text-secondary)' }}>
              Your role grants access to a custom set of modules. Use the navigation panel to access the pages assigned to your account.
            </div>
          </div>
        )}
      </div>

      {/* Charts row */}
      {(showSalesChart || showStationChart) && (
        <div style={{ display: 'grid', gridTemplateColumns: showSalesChart && showStationChart ? '1fr 1fr' : '1fr', gap: 20, marginBottom: 24 }}>
          {showSalesChart && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Transit Loss Trend</div>
                <span className="badge badge-info">6-month view</span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData.transitLossHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="month" tick={{ fill: '#4a5578', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#4a5578', fontSize: 11 }} axisLine={false} tickLine={false} unit="L" />
                  <Tooltip formatter={(v) => `${v.toLocaleString()} L`} contentStyle={{ background: 'var(--bg-raised)', border: '1px solid var(--border-bright)', borderRadius: 8 }} />
                  <ReferenceLine y={500} stroke="var(--danger)" strokeDasharray="4 4" label={{ value: 'Threshold', fill: 'var(--danger)', fontSize: 11 }} />
                  <Bar dataKey="loss" name="Transit Loss (L)" fill="#3d8ef0" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {showStationChart && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Station Performance vs Target</div>
                <span className="badge badge-success">This Month</span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData.stationPerformance} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis type="number" tickFormatter={v => formatCurrency(v, currency)} tick={{ fill: '#4a5578', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" tick={{ fill: '#8b9cc4', fontSize: 11 }} axisLine={false} tickLine={false} width={65} />
                  <Tooltip formatter={(v) => fmtKES(v)} contentStyle={{ background: 'var(--bg-raised)', border: '1px solid var(--border-bright)', borderRadius: 8 }} />
                  <Bar dataKey="sales" name="Actual" fill="#3d8ef0" radius={[0,4,4,0]} />
                  <Bar dataKey="target" name="Target" fill="rgba(255,255,255,0.1)" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Bottom row */}
      <div style={{ display: 'grid', gridTemplateColumns: showRecentAlerts && showFleetSummary ? '1fr 1fr 1fr' : showRecentAlerts || showFleetSummary ? '1fr 1fr' : '1fr', gap: 20 }}>
        {showRecentAlerts && (
          <div className="card" style={{ gridColumn: showFleetSummary ? 'span 2' : 'span 1' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Recent Alerts</div>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/alerts')}>View all</button>
            </div>
            {alerts.slice(0, 5).map(alert => (
              <div key={alert.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 4, flexShrink: 0, background: alert.severity === 'critical' ? 'var(--danger)' : alert.severity === 'high' ? 'var(--warning)' : alert.severity === 'warning' ? 'var(--amber)' : 'var(--info)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{alert.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alert.message}</div>
                </div>
                <span className={`badge badge-${alert.severity === 'critical' ? 'danger' : alert.severity === 'high' ? 'warning' : 'info'}`}>{alert.severity}</span>
              </div>
            ))}
          </div>
        )}

        {showFleetSummary && (
          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>Fleet Status</div>
            {[
              { label: 'In Transit', count: fleet.filter(v => v.status === 'in-transit').length, color: 'var(--success)' },
              { label: 'Loading', count: fleet.filter(v => v.status === 'loading').length, color: 'var(--accent)' },
              { label: 'Idle', count: fleet.filter(v => v.status === 'idle').length, color: 'var(--text-muted)' },
              { label: 'Delivered', count: fleet.filter(v => v.status === 'delivered').length, color: 'var(--info)' },
              { label: 'Maintenance', count: fleet.filter(v => v.status === 'maintenance').length, color: 'var(--warning)' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{item.label}</span>
                </div>
                <span style={{ fontWeight: 700, fontSize: 14, color: item.color }}>{item.count}</span>
              </div>
            ))}
            <hr className="divider" />
            <button className="btn btn-secondary w-full" style={{ justifyContent: 'center', fontSize: 12 }} onClick={() => navigate('/fleet')}>
              View Fleet
            </button>
          </div>
        )}

        {showEmptyDashboardState && (
          <div className="card" style={{ gridColumn: '1 / -1', padding: 24, textAlign: 'center' }}>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>No dashboard sections available</div>
            <div style={{ color: 'var(--text-secondary)' }}>
              Your current role does not include dashboard widgets. Please use the sidebar to access permitted modules or contact an administrator for access.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon, iconBg, iconColor, label, value, change, changeGood }) {
  return (
    <div className="stat-card">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="stat-label">{label}</div>
          <div className="stat-value">{value}</div>
          <div className="stat-change" style={{ color: changeGood ? 'var(--success)' : 'var(--warning)' }}>{change}</div>
        </div>
        <div className="stat-icon" style={{ background: iconBg, color: iconColor }}>{icon}</div>
      </div>
    </div>
  )
}

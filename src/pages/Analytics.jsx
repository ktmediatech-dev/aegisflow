import React, { useState } from 'react'
import { useStore } from '../store/useStore.js'
import {
  BarChart, Bar, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ReferenceLine
} from 'recharts'
import { TrendingUp, TrendingDown, Fuel, AlertTriangle } from 'lucide-react'
import { formatCurrency } from '../utils/currency.js'

const fmt = (n) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(0)}K` : n

const MoneyTT = (currency) => ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-bright)', borderRadius: 8, padding: '10px 14px' }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ fontSize: 12, color: p.color || p.fill, marginBottom: 2 }}>
          {p.name}: {typeof p.value === 'number' ? formatCurrency(p.value, currency) : p.value}
        </div>
      ))}
    </div>
  )
}

const TT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-bright)', borderRadius: 8, padding: '10px 14px' }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ fontSize: 12, color: p.color || p.fill, marginBottom: 2 }}>
          {p.name}: {typeof p.value === 'number' ? fmt(p.value) : p.value}
        </div>
      ))}
    </div>
  )
}

export default function Analytics() {
  const { stations, fleet, tankReadings, maintenanceJobs, transitLogs, chartData, currency } = useStore()
  const chart = chartData
  const MoneyTooltip = MoneyTT(currency)

  const totalRevenue = stations.reduce((s, st) => s + st.monthlySales, 0)
  const avgRisk = (stations.reduce((s, st) => s + st.riskScore, 0) / (stations.length || 1)).toFixed(1)
  const totalTransitLoss = transitLogs?.reduce((s, t) => s + t.transitLoss, 0) || 0
  const flaggedCount = transitLogs?.filter(t => t.flagged).length || 0

  // Efficiency only means something once a station has a sales target set
  // (Stations page); stations without one are left out of the radar rather
  // than compared against a made-up benchmark.
  const radarData = (chart.stationPerformance || [])
    .filter((s) => s.efficiency != null)
    .slice(0, 6)
    .map((s) => {
      const station = stations.find((st) => st.name === s.name)
      return { station: s.name, efficiency: s.efficiency, risk: 100 - (station?.riskScore ?? 0) }
    })

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <div className="page-title">Analytics</div>
          <div className="page-subtitle">Business Intelligence & Network-Wide Insights</div>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-label">Total Network Revenue</div>
          <div className="stat-value">{formatCurrency(totalRevenue, currency)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Risk Score</div>
          <div className="stat-value" style={{ color: avgRisk > 30 ? 'var(--danger)' : avgRisk > 15 ? 'var(--warning)' : 'var(--success)' }}>{avgRisk}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Transit Loss</div>
          <div className="stat-value">{totalTransitLoss.toLocaleString()} L</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Flagged Shipments</div>
          <div className="stat-value" style={{ color: flaggedCount > 0 ? 'var(--warning)' : 'var(--success)' }}>{flaggedCount}</div>
        </div>
      </div>

      {chart?.stationPerformance?.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><div className="card-title">Monthly Sales by Station</div></div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chart.stationPerformance}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => formatCurrency(v, currency)} />
              <Tooltip content={<MoneyTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="sales" name="Monthly Sales" fill="#3d8ef0" radius={[4, 4, 0, 0]} />
              <Bar dataKey="target" name="Target" fill="#3fb950" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
            Set a station's Sales Target on the Stations page to compare it against actual sales here.
          </div>
        </div>
      )}

      <div className="grid-2" style={{ marginBottom: 20 }}>
        {chart?.tankVariance && (
          <div className="card">
            <div className="card-header"><div className="card-title">Tank Variance vs Industry Limit</div></div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chart.tankVariance}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="station" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<TT />} />
                <Bar dataKey="variance" name="Variance %" fill="#d29922" radius={[4, 4, 0, 0]} />
                <ReferenceLine y={0.5} stroke="var(--danger)" strokeDasharray="4 2" label={{ value: 'Limit', fontSize: 10, fill: 'var(--danger)' }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {chart?.maintenanceCosts && (
          <div className="card">
            <div className="card-header"><div className="card-title">Maintenance Costs: Planned vs Unplanned</div></div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chart.maintenanceCosts}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => formatCurrency(v, currency)} />
                <Tooltip content={<MoneyTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="planned" name="Planned" fill="#3fb950" radius={[4, 4, 0, 0]} />
                <Bar dataKey="unplanned" name="Unplanned" fill="#f85149" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">Station Efficiency vs Risk Profile</div></div>
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="var(--border)" />
            <PolarAngleAxis dataKey="station" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
            <PolarRadiusAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
            <Radar name="Efficiency" dataKey="efficiency" stroke="#3d8ef0" fill="#3d8ef0" fillOpacity={0.25} />
            <Radar name="Safety (inverse risk)" dataKey="risk" stroke="#3fb950" fill="#3fb950" fillOpacity={0.15} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Tooltip content={<TT />} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

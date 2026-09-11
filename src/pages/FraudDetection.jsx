import React, { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { ShieldAlert, AlertTriangle, TrendingDown, Eye } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts'

const RISK_LEVEL = (score) => score >= 50 ? 'high' : score >= 20 ? 'medium' : 'low'

export default function FraudDetection() {
  const { stations, tankReadings, transitLogs, chartData } = useStore()
  const [tab, setTab] = useState('variance')

  const anomalies = tankReadings.filter(t => t.status === 'anomaly' || t.status === 'critical')
  const flaggedTransits = transitLogs.filter(t => t.flagged)
  const highRiskStations = stations.filter(s => s.riskScore >= 50)

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <div className="page-title">Fraud Detection</div>
          <div className="page-subtitle">Variance analysis, transit-loss monitoring & risk scoring</div>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-label">Tank Anomalies</div>
          <div className="stat-value" style={{ color: anomalies.length ? 'var(--danger)' : 'var(--success)' }}>{anomalies.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Flagged Shipments</div>
          <div className="stat-value" style={{ color: flaggedTransits.length ? 'var(--warning)' : 'var(--success)' }}>{flaggedTransits.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">High-Risk Stations</div>
          <div className="stat-value" style={{ color: highRiskStations.length ? 'var(--danger)' : 'var(--success)' }}>{highRiskStations.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Transit Loss</div>
          <div className="stat-value">{transitLogs.reduce((s, t) => s + t.transitLoss, 0).toLocaleString()} L</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['variance', 'transit', 'station-risk'].map(t => (
          <button key={t} className={`btn btn-sm ${tab === t ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(t)} style={{ textTransform: 'capitalize' }}>
            {t.replace('-', ' ')}
          </button>
        ))}
      </div>

      {tab === 'variance' && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><div className="card-title">Tank Variance vs Industry Limit (0.5%)</div></div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData.tankVariance}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="station" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-bright)', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="variance" name="Variance %" fill="#f85149" radius={[4, 4, 0, 0]} />
              <ReferenceLine y={0.5} stroke="var(--warning)" strokeDasharray="4 2" />
            </BarChart>
          </ResponsiveContainer>

          <div className="table-wrap" style={{ marginTop: 16 }}>
            <table>
              <thead><tr><th>Tank</th><th>Station</th><th>Product</th><th>Variance</th><th>Status</th></tr></thead>
              <tbody>
                {tankReadings.map(t => (
                  <tr key={t.id}>
                    <td>{t.tankNo}</td>
                    <td>{t.stationName}</td>
                    <td>{t.product}</td>
                    <td className="mono" style={{ color: Math.abs(t.variancePct) > 1 ? 'var(--danger)' : 'var(--text-primary)' }}>{t.variancePct}%</td>
                    <td>
                      <span className={`badge ${t.status === 'normal' ? 'badge-success' : t.status === 'warning' ? 'badge-warning' : 'badge-danger'}`}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'transit' && (
        <div className="card">
          <div className="card-header"><div className="card-title">Transit Logs</div></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Vehicle</th><th>Route</th><th>Product</th><th>Loaded</th><th>Delivered</th><th>Loss</th><th>Status</th></tr></thead>
              <tbody>
                {transitLogs.map(t => (
                  <tr key={t.id} style={t.flagged ? { background: 'var(--danger-dim)' } : {}}>
                    <td className="mono">{t.plate}</td>
                    <td style={{ fontSize: 12 }}>{t.route}</td>
                    <td>{t.product}</td>
                    <td className="mono">{t.loadedQty.toLocaleString()}L</td>
                    <td className="mono">{t.deliveredQty.toLocaleString()}L</td>
                    <td className="mono" style={{ color: t.flagged ? 'var(--danger)' : 'var(--text-secondary)' }}>{t.transitLoss}L ({t.lossPct}%)</td>
                    <td>
                      {t.flagged
                        ? <span className="badge badge-danger"><AlertTriangle size={10} /> Flagged</span>
                        : <span className="badge badge-success">Normal</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'station-risk' && (
        <div className="card">
          <div className="card-header"><div className="card-title">Station Risk Ranking</div></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Station</th><th>Region</th><th>Risk Score</th><th>Last Audit</th><th>Level</th></tr></thead>
              <tbody>
                {[...stations].sort((a, b) => b.riskScore - a.riskScore).map(s => {
                  const level = RISK_LEVEL(s.riskScore)
                  return (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 500 }}>{s.name}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{s.region}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="progress-wrap" style={{ width: 80 }}>
                            <div className="progress-bar" style={{ width: `${s.riskScore}%`, background: level === 'high' ? 'var(--danger)' : level === 'medium' ? 'var(--warning)' : 'var(--success)' }} />
                          </div>
                          <span className={`risk-${level}`} style={{ fontWeight: 600, fontSize: 13 }}>{s.riskScore}</span>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{s.lastAudit}</td>
                      <td><span className={`badge badge-${level === 'high' ? 'danger' : level === 'medium' ? 'warning' : 'success'}`}>{level}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

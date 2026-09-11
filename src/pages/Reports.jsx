import React, { useState, useMemo } from 'react'
import { useStore } from '../store/useStore.js'
import { FileText, Download, Printer, Building2, Fuel, Truck, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency, convertFromKES, getCurrency } from '../utils/currency.js'

const REPORT_TYPES = [
  { key: 'station-performance', label: 'Station Performance', icon: Building2 },
  { key: 'fleet-status', label: 'Fleet Status', icon: Truck },
  { key: 'risk-compliance', label: 'Risk & Compliance', icon: ShieldAlert },
  { key: 'fuel-summary', label: 'Fuel & Tank Summary', icon: Fuel },
]

export default function Reports() {
  const { stations, fleet, tankReadings, maintenanceJobs, contractors, suppliers, transitLogs, currency } = useStore()
  const fmt = (n) => formatCurrency(n, currency, { compact: false })
  const [reportType, setReportType] = useState('station-performance')
  const [region, setRegion] = useState('all')

  const regions = useMemo(() => ['all', ...new Set(stations.map(s => s.region))], [stations])
  const filteredStations = region === 'all' ? stations : stations.filter(s => s.region === region)

  const generatedAt = new Date().toLocaleString('en-KE', { dateStyle: 'long', timeStyle: 'short' })

  const handlePrint = () => window.print()

  const handleExportCSV = () => {
    let rows = []
    if (reportType === 'station-performance') {
      rows = filteredStations.map(s => ({
        Station: s.name, Region: s.region, Manager: s.manager, Status: s.status,
        MonthlySales: s.monthlySales, RiskScore: s.riskScore, LastAudit: s.lastAudit,
      }))
    } else if (reportType === 'fleet-status') {
      rows = fleet.map(v => ({ Plate: v.plate, Type: v.type, Driver: v.driver, Status: v.status, Mileage: v.mileage, NextService: v.nextService }))
    } else if (reportType === 'risk-compliance') {
      rows = filteredStations.map(s => ({ Station: s.name, Region: s.region, RiskScore: s.riskScore, LastAudit: s.lastAudit }))
    } else if (reportType === 'fuel-summary') {
      rows = tankReadings.map(t => ({ Station: t.stationName, Tank: t.tankNo, Product: t.product, CurrentLevel: t.currentLevel, Capacity: t.capacity, VariancePct: t.variancePct, Status: t.status }))
    }
    if (!rows.length) { toast.error('No data to export'); return }
    const headers = Object.keys(rows[0])
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${r[h]}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${reportType}_${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Report exported as CSV')
  }

  const totalRevenue = filteredStations.reduce((s, st) => s + st.monthlySales, 0)
  const avgRisk = (filteredStations.reduce((s, st) => s + st.riskScore, 0) / (filteredStations.length || 1)).toFixed(1)
  const operational = filteredStations.filter(s => s.status === 'operational').length

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <div className="page-title">Reports</div>
          <div className="page-subtitle">Generate and export network reports by region or company</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={handlePrint}><Printer size={13} /> Print</button>
          <button className="btn btn-primary btn-sm" onClick={handleExportCSV}><Download size={13} /> Export CSV</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="form-label">Report Type</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {REPORT_TYPES.map(r => (
                <button
                  key={r.key}
                  className={`btn btn-sm ${reportType === r.key ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setReportType(r.key)}
                >
                  <r.icon size={13} /> {r.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ minWidth: 180 }}>
            <div className="form-label">Region / Company Filter</div>
            <select className="form-select" value={region} onChange={(e) => setRegion(e.target.value)}>
              {regions.map(r => <option key={r} value={r}>{r === 'all' ? 'All Regions' : r}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Report header */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{REPORT_TYPES.find(r => r.key === reportType)?.label} Report</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Scope: {region === 'all' ? 'Entire Network' : region} · Generated {generatedAt}</div>
          </div>
          <FileText size={24} color="var(--accent)" />
        </div>

        <div className="grid-3" style={{ marginBottom: 16 }}>
          <div className="stat-card">
            <div className="stat-label">Stations Covered</div>
            <div className="stat-value">{filteredStations.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Monthly Revenue</div>
            <div className="stat-value">{fmt(totalRevenue)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Avg Risk Score</div>
            <div className="stat-value" style={{ color: avgRisk > 30 ? 'var(--danger)' : avgRisk > 15 ? 'var(--warning)' : 'var(--success)' }}>{avgRisk}</div>
          </div>
        </div>

        {/* Report body by type */}
        {reportType === 'station-performance' && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Station</th><th>Region</th><th>Manager</th><th>Status</th><th>Monthly Sales</th><th>Risk</th></tr></thead>
              <tbody>
                {filteredStations.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 500 }}>{s.name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{s.region}</td>
                    <td>{s.manager}</td>
                    <td><span className={`badge ${s.status === 'operational' ? 'badge-success' : s.status === 'maintenance' ? 'badge-warning' : 'badge-danger'}`}>{s.status}</span></td>
                    <td className="mono">{fmt(s.monthlySales)}</td>
                    <td className={s.riskScore > 50 ? 'risk-high' : s.riskScore > 20 ? 'risk-medium' : 'risk-low'} style={{ fontWeight: 600 }}>{s.riskScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {reportType === 'fleet-status' && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Plate</th><th>Type</th><th>Driver</th><th>Status</th><th>Mileage</th><th>Next Service</th></tr></thead>
              <tbody>
                {fleet.map(v => (
                  <tr key={v.id}>
                    <td className="mono">{v.plate}</td>
                    <td>{v.type}</td>
                    <td>{v.driver}</td>
                    <td><span className="badge badge-info">{v.status}</span></td>
                    <td className="mono">{v.mileage.toLocaleString()} km</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{v.nextService}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {reportType === 'risk-compliance' && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Station</th><th>Region</th><th>Risk Score</th><th>Last Audit</th></tr></thead>
              <tbody>
                {[...filteredStations].sort((a, b) => b.riskScore - a.riskScore).map(s => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 500 }}>{s.name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{s.region}</td>
                    <td className={s.riskScore > 50 ? 'risk-high' : s.riskScore > 20 ? 'risk-medium' : 'risk-low'} style={{ fontWeight: 600 }}>{s.riskScore}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{s.lastAudit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {reportType === 'fuel-summary' && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Station</th><th>Tank</th><th>Product</th><th>Level</th><th>Capacity</th><th>Variance</th><th>Status</th></tr></thead>
              <tbody>
                {tankReadings.map(t => (
                  <tr key={t.id}>
                    <td>{t.stationName}</td>
                    <td>{t.tankNo}</td>
                    <td>{t.product}</td>
                    <td className="mono">{t.currentLevel.toLocaleString()}L</td>
                    <td className="mono">{t.capacity.toLocaleString()}L</td>
                    <td className="mono">{t.variancePct}%</td>
                    <td><span className={`badge ${t.status === 'normal' ? 'badge-success' : t.status === 'warning' ? 'badge-warning' : 'badge-danger'}`}>{t.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

import React, { useState, useMemo } from 'react'
import { useStore } from '../store/useStore.js'
import { FileText, Download, Printer, Building2, Fuel, Truck, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency, convertFromKES, getCurrency } from '../utils/currency.js'

const REPORT_TYPES = [
  { key: 'station-performance', label: 'Station Performance', icon: Building2 },
  { key: 'fleet-status', label: 'Fleet Status', icon: Truck },
  { key: 'truck-statement', label: 'Truck Statement', icon: Truck },
  { key: 'risk-compliance', label: 'Risk & Compliance', icon: ShieldAlert },
  { key: 'fuel-summary', label: 'Fuel & Tank Summary', icon: Fuel },
]

const todayStr = () => new Date().toISOString().slice(0, 10)
const monthsAgoStr = (n) => { const d = new Date(); d.setMonth(d.getMonth() - n); return d.toISOString().slice(0, 10) }

export default function Reports() {
  const { stations, fleet, tankReadings, maintenanceJobs, contractors, suppliers, transitLogs, currency } = useStore()
  const fmt = (n) => formatCurrency(n, currency, { compact: false })
  const [reportType, setReportType] = useState('station-performance')
  const [region, setRegion] = useState('all')
  const [truckPlate, setTruckPlate] = useState('')
  const [truckRange, setTruckRange] = useState({ start: monthsAgoStr(3), end: todayStr() })

  const regions = useMemo(() => ['all', ...new Set(stations.map(s => s.region))], [stations])
  const filteredStations = region === 'all' ? stations : stations.filter(s => s.region === region)

  // Truck statement: every trip a single vehicle ran, across every
  // station/route it touched, within a chosen period — for judging a
  // specific truck's (or hired transporter's) performance and losses.
  const truckTrips = useMemo(() => {
    if (!truckPlate) return []
    return transitLogs
      .filter(t => t.plate === truckPlate && (!t.arrDate || (t.arrDate >= truckRange.start && t.arrDate <= truckRange.end)))
      .sort((a, b) => (b.arrDate || b.depDate || '').localeCompare(a.arrDate || a.depDate || ''))
  }, [transitLogs, truckPlate, truckRange])

  const truckSummary = useMemo(() => {
    const trips = truckTrips
    const totalLoaded = trips.reduce((s, t) => s + Number(t.loadedQty || 0), 0)
    const totalDelivered = trips.reduce((s, t) => s + Number(t.deliveredQty || 0), 0)
    const totalLoss = trips.reduce((s, t) => s + Number(t.transitLoss || 0), 0)
    const avgLossPct = trips.length ? trips.reduce((s, t) => s + Number(t.lossPct || 0), 0) / trips.length : 0
    const flaggedCount = trips.filter(t => t.flagged).length
    const routes = new Set(trips.map(t => t.route).filter(Boolean))
    return { totalLoaded, totalDelivered, totalLoss, avgLossPct, flaggedCount, routeCount: routes.size, tripCount: trips.length }
  }, [truckTrips])

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
    } else if (reportType === 'truck-statement') {
      rows = truckTrips.map(t => ({ Date: t.arrDate || t.depDate, Route: t.route, Product: t.product, LoadedL: t.loadedQty, DeliveredL: t.deliveredQty, LossL: t.transitLoss, LossPct: t.lossPct, Status: t.status, Flagged: t.flagged ? 'Yes' : 'No' }))
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
          {reportType === 'truck-statement' ? (
            <>
              <div style={{ minWidth: 180 }}>
                <div className="form-label">Truck / Vehicle</div>
                <select className="form-select" value={truckPlate} onChange={(e) => setTruckPlate(e.target.value)}>
                  <option value="">Select a vehicle...</option>
                  {fleet.map(v => <option key={v.id} value={v.plate}>{v.plate} ({v.type}{v.ownership ? `, ${v.ownership}` : ''})</option>)}
                </select>
              </div>
              <div style={{ minWidth: 140 }}>
                <div className="form-label">From</div>
                <input type="date" className="form-input" value={truckRange.start} onChange={(e) => setTruckRange(r => ({ ...r, start: e.target.value }))} />
              </div>
              <div style={{ minWidth: 140 }}>
                <div className="form-label">To</div>
                <input type="date" className="form-input" value={truckRange.end} onChange={(e) => setTruckRange(r => ({ ...r, end: e.target.value }))} />
              </div>
            </>
          ) : (
            <div style={{ minWidth: 180 }}>
              <div className="form-label">Region / Company Filter</div>
              <select className="form-select" value={region} onChange={(e) => setRegion(e.target.value)}>
                {regions.map(r => <option key={r} value={r}>{r === 'all' ? 'All Regions' : r}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Report header */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{REPORT_TYPES.find(r => r.key === reportType)?.label} Report</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Scope: {reportType === 'truck-statement'
                ? (truckPlate ? `${truckPlate} · ${truckRange.start} → ${truckRange.end}` : 'Select a vehicle')
                : (region === 'all' ? 'Entire Network' : region)} · Generated {generatedAt}
            </div>
          </div>
          <FileText size={24} color="var(--accent)" />
        </div>

        {reportType === 'truck-statement' ? (
          <div className="grid-3" style={{ marginBottom: 16 }}>
            <div className="stat-card">
              <div className="stat-label">Trips in Period</div>
              <div className="stat-value">{truckSummary.tripCount}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Loaded / Delivered</div>
              <div className="stat-value" style={{ fontSize: 18 }}>{truckSummary.totalLoaded.toLocaleString()} / {truckSummary.totalDelivered.toLocaleString()} L</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Loss</div>
              <div className="stat-value" style={{ color: truckSummary.totalLoss > 0 ? 'var(--danger)' : 'var(--success)' }}>{truckSummary.totalLoss.toLocaleString()} L</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Avg Loss %</div>
              <div className="stat-value" style={{ color: truckSummary.avgLossPct > 1 ? 'var(--danger)' : truckSummary.avgLossPct > 0.5 ? 'var(--warning)' : 'var(--success)' }}>{truckSummary.avgLossPct.toFixed(2)}%</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Routes Covered</div>
              <div className="stat-value">{truckSummary.routeCount}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Flagged Trips</div>
              <div className="stat-value" style={{ color: truckSummary.flaggedCount > 0 ? 'var(--danger)' : 'var(--success)' }}>{truckSummary.flaggedCount}</div>
            </div>
          </div>
        ) : (
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
        )}

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

        {reportType === 'truck-statement' && (
          <div className="table-wrap">
            {!truckPlate ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Select a vehicle above to run its statement.</div>
            ) : !truckTrips.length ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>No trips for {truckPlate} in this period.</div>
            ) : (
              <table>
                <thead><tr><th>Date</th><th>Route</th><th>Product</th><th>Loaded (L)</th><th>Delivered (L)</th><th>Loss (L)</th><th>Loss %</th><th>Status</th><th>Flagged</th></tr></thead>
                <tbody>
                  {truckTrips.map(t => (
                    <tr key={t.id}>
                      <td style={{ color: 'var(--text-secondary)' }}>{t.arrDate || t.depDate || '—'}</td>
                      <td>{t.route}</td>
                      <td>{t.product}</td>
                      <td className="mono">{Number(t.loadedQty).toLocaleString()}</td>
                      <td className="mono">{Number(t.deliveredQty).toLocaleString()}</td>
                      <td className="mono" style={{ color: Number(t.transitLoss) > 500 ? 'var(--danger)' : 'var(--warning)' }}>-{Number(t.transitLoss).toLocaleString()}</td>
                      <td className="mono" style={{ color: Number(t.lossPct) > 1 ? 'var(--danger)' : Number(t.lossPct) > 0.5 ? 'var(--warning)' : 'var(--success)' }}>{Number(t.lossPct).toFixed(2)}%</td>
                      <td><span className="badge badge-info">{t.status}</span></td>
                      <td>{t.flagged ? <span className="badge badge-danger">Flagged</span> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
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

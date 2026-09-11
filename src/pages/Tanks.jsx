import React, { useState, useEffect } from 'react'
import { useStore } from '../store/useStore.js'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts'
import { AlertTriangle, TrendingDown, CheckCircle, Search, Plus } from 'lucide-react'
import toast from 'react-hot-toast'

const TANK_STATUS = {
  normal: { label: 'Normal', cls: 'badge-success', color: 'var(--success)' },
  warning: { label: 'Warning', cls: 'badge-warning', color: 'var(--warning)' },
  critical: { label: 'Critical', cls: 'badge-danger', color: 'var(--danger)' },
  anomaly: { label: 'Anomaly', cls: 'badge-danger', color: 'var(--danger)' },
}

export default function Tanks() {
  const {
    tankReadings, transitLogs, chartData, stations,
    nozzles, nozzleReadings, nozzleReconciliation, fetchNozzleData, addNozzle, addNozzleReading,
  } = useStore()
  const [tab, setTab] = useState('readings')
  const [search, setSearch] = useState('')
  const [nozzleDataLoaded, setNozzleDataLoaded] = useState(false)
  const [showNozzleModal, setShowNozzleModal] = useState(false)
  const [showReadingModal, setShowReadingModal] = useState(false)
  const [nozzleForm, setNozzleForm] = useState({ stationId: '', tankNo: '', product: 'PMS', capacity: 20000, label: '' })
  const [readingForm, setReadingForm] = useState({ nozzleId: '', readingDate: new Date().toISOString().slice(0, 10), openingMeter: '', closingMeter: '' })

  useEffect(() => {
    if (tab === 'nozzles' && !nozzleDataLoaded) {
      fetchNozzleData().then(() => setNozzleDataLoaded(true)).catch(() => {})
    }
  }, [tab, nozzleDataLoaded, fetchNozzleData])

  const handleAddNozzle = async () => {
    if (!nozzleForm.stationId || !nozzleForm.tankNo || !nozzleForm.label) {
      toast.error('Station, tank number and label are required')
      return
    }
    try {
      await addNozzle(nozzleForm)
      toast.success('Nozzle added')
      setShowNozzleModal(false)
      setNozzleForm({ stationId: '', tankNo: '', product: 'PMS', capacity: 20000, label: '' })
    } catch (err) {
      toast.error(err.message || 'Failed to add nozzle')
    }
  }

  const handleAddReading = async () => {
    if (!readingForm.nozzleId || readingForm.openingMeter === '' || readingForm.closingMeter === '') {
      toast.error('Nozzle, opening meter and closing meter are required')
      return
    }
    try {
      await addNozzleReading({
        ...readingForm,
        openingMeter: Number(readingForm.openingMeter),
        closingMeter: Number(readingForm.closingMeter),
      })
      toast.success('Reading recorded')
      setShowReadingModal(false)
      setReadingForm({ nozzleId: '', readingDate: new Date().toISOString().slice(0, 10), openingMeter: '', closingMeter: '' })
    } catch (err) {
      toast.error(err.message || 'Failed to record reading')
    }
  }

  const filtered = tankReadings.filter(t => {
    const q = search.toLowerCase()
    return t.stationName.toLowerCase().includes(q) || t.product.toLowerCase().includes(q) || t.tankNo.toLowerCase().includes(q)
  })

  const totalVarianceLoss = tankReadings.reduce((s, t) => s + Math.abs(t.variance), 0)
  const anomalyTanks = tankReadings.filter(t => t.variancePct > 0.5).length
  const criticalTanks = tankReadings.filter(t => t.status === 'critical').length

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <div className="page-title">Tanks & Inventory</div>
          <div className="page-subtitle">Tank readings, losses, and transit reconciliation</div>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Total Tanks Monitored</div>
          <div className="stat-value">{tankReadings.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Variance Anomalies</div>
          <div className="stat-value" style={{ color: anomalyTanks > 0 ? 'var(--danger)' : 'var(--success)' }}>{anomalyTanks}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>&gt;0.5% threshold</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Daily Variance</div>
          <div className="stat-value">{totalVarianceLoss.toLocaleString()} L</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Critical Low Tanks</div>
          <div className="stat-value" style={{ color: criticalTanks > 0 ? 'var(--danger)' : 'var(--success)' }}>{criticalTanks}</div>
        </div>
      </div>

      <div className="tab-bar">
        {[['readings','Tank Readings'],['transit','Transit Logs'],['variance','Variance Chart'],['nozzles','Nozzles & Meters']].map(([k,l]) => (
          <button key={k} className={`tab-btn ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'readings' && (
        <>
          <div style={{ position: 'relative', marginBottom: 16, maxWidth: 380 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input style={{ paddingLeft: 34 }} placeholder="Search tanks…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Station</th><th>Tank</th><th>Product</th><th>Capacity</th>
                  <th>Level</th><th>Level %</th><th>Opening</th><th>Received</th>
                  <th>Sales</th><th>Variance</th><th>Var%</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => {
                  const levelPct = Math.round((t.currentLevel / t.capacity) * 100)
                  const varColor = t.variancePct > 1.5 ? 'var(--danger)' : t.variancePct > 0.5 ? 'var(--warning)' : 'var(--success)'
                  return (
                    <tr key={t.id}>
                      <td>{t.stationName}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{t.tankNo}</td>
                      <td><span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 700 }}>{t.product}</span></td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{t.capacity.toLocaleString()}L</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="progress-bar" style={{ width: 48 }}>
                            <div className="progress-fill" style={{ width: `${levelPct}%`, background: levelPct < 20 ? 'var(--danger)' : levelPct < 40 ? 'var(--warning)' : 'var(--success)' }} />
                          </div>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{t.currentLevel.toLocaleString()}L</span>
                        </div>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{levelPct}%</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{t.openingStock.toLocaleString()}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: t.received > 0 ? 'var(--success)' : '' }}>{t.received > 0 ? `+${t.received.toLocaleString()}` : '—'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{t.salesVolume.toLocaleString()}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: varColor, fontWeight: 600 }}>
                        {t.variance > 0 ? '+' : ''}{t.variance}L
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: varColor }}>{t.variancePct.toFixed(2)}%</td>
                      <td><span className={`badge ${TANK_STATUS[t.status]?.cls}`}>{TANK_STATUS[t.status]?.label}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'transit' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr><th>Vehicle</th><th>Route</th><th>Product</th><th>Loaded (L)</th><th>Delivered (L)</th><th>Loss (L)</th><th>Loss %</th><th>Driver</th><th>Status</th><th>Flagged</th></tr>
            </thead>
            <tbody>
              {transitLogs.map(t => (
                <tr key={t.id} style={{ background: t.flagged ? 'rgba(239,68,68,0.04)' : '' }}>
                  <td>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent)' }}>{t.plate}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.depDate} → {t.arrDate}</div>
                  </td>
                  <td style={{ fontSize: 12 }}>{t.route}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--info)' }}>{t.product}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{t.loadedQty.toLocaleString()}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{t.deliveredQty.toLocaleString()}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: t.transitLoss > 500 ? 'var(--danger)' : 'var(--warning)' }}>-{t.transitLoss}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: t.lossPct > 1 ? 'var(--danger)' : t.lossPct > 0.5 ? 'var(--warning)' : 'var(--success)' }}>{t.lossPct.toFixed(2)}%</td>
                  <td>{t.driver}</td>
                  <td>
                    <span className={`badge ${t.status === 'completed' ? 'badge-muted' : t.status === 'investigating' ? 'badge-warning' : 'badge-info'}`}>{t.status}</span>
                  </td>
                  <td>
                    {t.flagged
                      ? <span className="badge badge-danger"><AlertTriangle size={10} />Flagged</span>
                      : <span className="badge badge-success"><CheckCircle size={10} />Clear</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'variance' && (
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Tank Variance by Station</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>Acceptable threshold: 0.5%. Bars above the red line require investigation.</div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData.tankVariance}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="station" tick={{ fill: '#8b9cc4', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#4a5578', fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip formatter={v => `${v}%`} contentStyle={{ background: 'var(--bg-raised)', border: '1px solid var(--border-bright)', borderRadius: 8 }} />
              <ReferenceLine y={0.5} stroke="var(--danger)" strokeDasharray="4 4" label={{ value: 'Limit 0.5%', fill: 'var(--danger)', fontSize: 11 }} />
              <Bar dataKey="variance" fill="#3d8ef0" radius={[4,4,0,0]}
                label={{ position: 'top', fill: '#8b9cc4', fontSize: 10, formatter: v => `${v}%` }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {tab === 'nozzles' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowNozzleModal(true)}><Plus size={13} /> Add Nozzle</button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowReadingModal(true)}><Plus size={13} /> Record Meter Reading</button>
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Nozzle → Tank Reconciliation</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              Compares what each tank recorded as sold against what its nozzles actually metered on the same day. A gap over 2% is flagged as a possible leakage/theft signal.
            </div>
            {nozzleReconciliation.length === 0 ? (
              <div className="empty-state"><CheckCircle size={28} /><div>No overlapping tank-reading / meter-reading dates yet</div></div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr><th>Station</th><th>Tank</th><th>Date</th><th>Tank Sales</th><th>Nozzle Throughput</th><th>Variance</th><th>Var%</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {nozzleReconciliation.map((r, i) => (
                    <tr key={i} style={{ background: r.flagged ? 'rgba(239,68,68,0.04)' : '' }}>
                      <td>{r.station}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{r.tankNo}</td>
                      <td style={{ fontSize: 12 }}>{r.date}</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{r.salesVolume.toLocaleString()}L</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{r.nozzleThroughput.toLocaleString()}L</td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: r.flagged ? 'var(--danger)' : 'var(--text-secondary)' }}>{r.variance > 0 ? '+' : ''}{r.variance.toLocaleString()}L</td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: r.flagged ? 'var(--danger)' : 'var(--text-secondary)' }}>{r.variancePct.toFixed(2)}%</td>
                      <td>
                        {r.flagged
                          ? <span className="badge badge-danger"><AlertTriangle size={10} />Flagged</span>
                          : <span className="badge badge-success"><CheckCircle size={10} />Clear</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>Nozzles ({nozzles.length})</div>
            <table className="data-table">
              <thead><tr><th>Label</th><th>Station</th><th>Tank</th><th>Product</th><th>Status</th></tr></thead>
              <tbody>
                {nozzles.map(n => (
                  <tr key={n.id}>
                    <td>{n.label}</td>
                    <td>{n.station}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{n.tankNo}</td>
                    <td><span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{n.product}</span></td>
                    <td><span className="badge badge-success">{n.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ fontWeight: 600, padding: '14px 16px 0' }}>Recent Meter Readings</div>
            <table className="data-table">
              <thead><tr><th>Nozzle</th><th>Station</th><th>Date</th><th>Opening</th><th>Closing</th><th>Throughput</th></tr></thead>
              <tbody>
                {nozzleReadings.map(r => (
                  <tr key={r.id}>
                    <td>{r.nozzleLabel}</td>
                    <td>{r.station}</td>
                    <td style={{ fontSize: 12 }}>{r.readingDate}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{Number(r.openingMeter).toLocaleString()}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{Number(r.closingMeter).toLocaleString()}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{r.throughput.toLocaleString()}L</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showNozzleModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowNozzleModal(false)}>
          <div className="modal">
            <div className="modal-title">Add Nozzle<button className="btn btn-ghost btn-sm" onClick={() => setShowNozzleModal(false)}>✕</button></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Station</label>
                <select value={nozzleForm.stationId} onChange={e => setNozzleForm(p => ({...p, stationId: e.target.value}))}>
                  <option value="">Select station…</option>
                  {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Tank Number</label><input value={nozzleForm.tankNo} onChange={e => setNozzleForm(p => ({...p, tankNo: e.target.value}))} placeholder="e.g. T1" /></div>
              <div className="form-group"><label className="form-label">Nozzle Label</label><input value={nozzleForm.label} onChange={e => setNozzleForm(p => ({...p, label: e.target.value}))} placeholder="e.g. Pump 2 / Nozzle A" /></div>
              <div className="form-group">
                <label className="form-label">Product</label>
                <select value={nozzleForm.product} onChange={e => setNozzleForm(p => ({...p, product: e.target.value}))}>
                  {['PMS','AGO','DPK','LPG','BIK'].map(f => <option key={f}>{f}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Tank Capacity (L)</label><input type="number" value={nozzleForm.capacity} onChange={e => setNozzleForm(p => ({...p, capacity: e.target.value}))} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => setShowNozzleModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddNozzle}>Save</button>
            </div>
          </div>
        </div>
      )}

      {showReadingModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowReadingModal(false)}>
          <div className="modal">
            <div className="modal-title">Record Meter Reading<button className="btn btn-ghost btn-sm" onClick={() => setShowReadingModal(false)}>✕</button></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Nozzle</label>
                <select value={readingForm.nozzleId} onChange={e => setReadingForm(p => ({...p, nozzleId: e.target.value}))}>
                  <option value="">Select nozzle…</option>
                  {nozzles.map(n => <option key={n.id} value={n.id}>{n.label} — {n.station} ({n.tankNo})</option>)}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}><label className="form-label">Reading Date</label><input type="date" value={readingForm.readingDate} onChange={e => setReadingForm(p => ({...p, readingDate: e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">Opening Meter</label><input type="number" value={readingForm.openingMeter} onChange={e => setReadingForm(p => ({...p, openingMeter: e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">Closing Meter</label><input type="number" value={readingForm.closingMeter} onChange={e => setReadingForm(p => ({...p, closingMeter: e.target.value}))} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => setShowReadingModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddReading}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

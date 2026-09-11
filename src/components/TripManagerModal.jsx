import React, { useEffect, useState } from 'react'
import { useStore } from '../store/useStore.js'
import toast from 'react-hot-toast'

// Drives a trip through its full lifecycle: loading (depot) -> in-transit
// -> arrived (station) -> completed. Each stage's UI only shows what's
// actionable for the trip's current status.
export default function TripManagerModal({ trip, onClose }) {
  const {
    fleet, tanks, fetchVehicleCompartments, fetchCompartmentReadings,
    saveCompartmentReadings, arriveTransitLog, saveTankOpeningDip, fetchTankOffloadSummary,
  } = useStore()

  const [compartments, setCompartments] = useState([])
  const [readings, setReadings] = useState([])
  const [offloadSummary, setOffloadSummary] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // stage form state
  const [loadingRows, setLoadingRows] = useState([])
  const [deliveryRows, setDeliveryRows] = useState([])
  const [openingDipForm, setOpeningDipForm] = useState({ tankId: '', openingDipCm: '', openingVolumeLiters: '' })

  const vehicle = fleet.find((v) => v.id === trip.vehicleId)

  const load = async () => {
    setLoading(true)
    try {
      const [comps, reads] = await Promise.all([
        fetchVehicleCompartments(trip.vehicleId),
        fetchCompartmentReadings(trip.id),
      ])
      setCompartments(comps)
      setReadings(reads)
      if (['arrived', 'completed'].includes(trip.status)) {
        setOffloadSummary(await fetchTankOffloadSummary(trip.id))
      }
      setLoadingRows(comps.map((c) => ({ compartmentId: c.id, compartmentNo: c.compartmentNo, dipCm: '', volumeLiters: '', isEmpty: false, product: trip.product })))
      setDeliveryRows(comps.map((c) => ({ compartmentId: c.id, compartmentNo: c.compartmentNo, dipCm: '', volumeLiters: '', isEmpty: false, tankId: '' })))
    } catch (err) {
      toast.error(err.message || 'Failed to load trip details')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [trip.id])

  const loadingDone = readings.some((r) => r.stage === 'loading')
  const deliveryTanksTouched = [...new Set(readings.filter((r) => r.stage === 'delivery' && r.tankId).map((r) => r.tankId))]

  const handleSubmitLoading = async () => {
    const rows = loadingRows.filter((r) => r.isEmpty || r.volumeLiters !== '')
    if (!rows.length) { toast.error('Enter a reading for at least one compartment'); return }
    setSaving(true)
    try {
      await saveCompartmentReadings(trip.id, 'loading', rows.map((r) => ({
        compartmentId: r.compartmentId, dipCm: r.dipCm || null, volumeLiters: Number(r.volumeLiters) || 0,
        isEmpty: r.isEmpty, product: r.product,
      })))
      toast.success('Loading dips recorded — truck marked in-transit')
      await load()
    } catch (err) {
      toast.error(err.message || 'Failed to save loading dips')
    } finally {
      setSaving(false)
    }
  }

  const handleArrive = async () => {
    setSaving(true)
    try {
      await arriveTransitLog(trip.id)
      toast.success('Arrival recorded')
      await load()
    } catch (err) {
      toast.error(err.message || 'Failed to record arrival')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveOpeningDip = async () => {
    if (!openingDipForm.tankId || openingDipForm.openingVolumeLiters === '') {
      toast.error('Select a tank and enter its opening volume')
      return
    }
    setSaving(true)
    try {
      await saveTankOpeningDip(trip.id, {
        tankId: openingDipForm.tankId,
        openingDipCm: openingDipForm.openingDipCm || null,
        openingVolumeLiters: Number(openingDipForm.openingVolumeLiters),
      })
      toast.success('Tank opening dip recorded')
      setOpeningDipForm({ tankId: '', openingDipCm: '', openingVolumeLiters: '' })
      await load()
    } catch (err) {
      toast.error(err.message || 'Failed to save tank opening dip')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmitDelivery = async () => {
    const rows = deliveryRows.filter((r) => r.isEmpty || r.volumeLiters !== '')
    if (!rows.length) { toast.error('Enter a reading for at least one compartment'); return }
    if (rows.some((r) => !r.isEmpty && !r.tankId)) { toast.error('Select a target tank for every non-empty compartment'); return }
    setSaving(true)
    try {
      await saveCompartmentReadings(trip.id, 'delivery', rows.map((r) => ({
        compartmentId: r.compartmentId, dipCm: r.dipCm || null, volumeLiters: Number(r.volumeLiters) || 0,
        isEmpty: r.isEmpty, tankId: r.isEmpty ? null : r.tankId,
      })))
      toast.success('Delivery dips recorded — trip completed')
      await load()
    } catch (err) {
      toast.error(err.message || 'Failed to save delivery dips')
    } finally {
      setSaving(false)
    }
  }

  const dippedTanksWithOpening = new Set(offloadSummary.map((o) => o.tankId))

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 720 }}>
        <div className="modal-title">
          Trip — {trip.plate} · {trip.route}
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
          Product: <strong>{trip.product}</strong> · Status: <span className="badge badge-info">{trip.status}</span>
          {trip.depAt && <> · Departed {new Date(trip.depAt).toLocaleString()}</>}
          {trip.arrAt && <> · Arrived {new Date(trip.arrAt).toLocaleString()}</>}
        </div>

        {loading ? (
          <div style={{ color: 'var(--text-muted)' }}>Loading…</div>
        ) : (
          <>
            {/* --- LOADING stage --- */}
            {trip.status === 'loading' && (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Loading dip sheet (depot)</div>
                {compartments.length === 0 ? (
                  <div className="alert-bar warning" style={{ marginBottom: 12 }}>
                    {vehicle?.plate || 'This vehicle'} has no registered compartments — register them from the Fleet page first.
                  </div>
                ) : (
                  <CompartmentDipTable
                    rows={loadingRows} setRows={setLoadingRows}
                    showProduct extraLabel="Product Loaded"
                  />
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                  <button className="btn btn-primary" onClick={handleSubmitLoading} disabled={saving || !compartments.length}>
                    {saving ? 'Saving…' : 'Record Loading & Depart'}
                  </button>
                </div>
              </div>
            )}

            {/* --- IN-TRANSIT stage --- */}
            {trip.status === 'in-transit' && (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Loaded {Number(trip.loadedQty).toLocaleString()}L — en route</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                  Once the truck physically arrives at the destination station, record arrival before entering delivery dips.
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn btn-primary" onClick={handleArrive} disabled={saving}>
                    {saving ? 'Saving…' : 'Record Arrival'}
                  </button>
                </div>
              </div>
            )}

            {/* --- ARRIVED stage --- */}
            {trip.status === 'arrived' && (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>1. Capture receiving tank opening dips</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 10 }}>
                  <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                    <label className="form-label">Tank</label>
                    <select value={openingDipForm.tankId} onChange={e => setOpeningDipForm(p => ({...p, tankId: e.target.value}))}>
                      <option value="">Select tank…</option>
                      {tanks.filter((t) => t.product === trip.product).map((t) => (
                        <option key={t.id} value={t.id}>{t.station} — {t.tankNo} ({t.product})</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0, width: 120 }}>
                    <label className="form-label">Dip (cm)</label>
                    <input type="number" value={openingDipForm.openingDipCm} onChange={e => setOpeningDipForm(p => ({...p, openingDipCm: e.target.value}))} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0, width: 140 }}>
                    <label className="form-label">Volume (L)</label>
                    <input type="number" value={openingDipForm.openingVolumeLiters} onChange={e => setOpeningDipForm(p => ({...p, openingVolumeLiters: e.target.value}))} />
                  </div>
                  <button className="btn btn-secondary" onClick={handleSaveOpeningDip} disabled={saving}>Add</button>
                </div>
                {offloadSummary.length > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                    Opening dips captured: {offloadSummary.map((o) => `${o.tank?.tankNo || o.tankId} (${Number(o.openingVolumeLiters).toLocaleString()}L)`).join(', ')}
                  </div>
                )}

                <div style={{ fontWeight: 600, marginBottom: 8, marginTop: 20 }}>2. Delivery dip sheet — assign each compartment to a tank</div>
                {dippedTanksWithOpening.size === 0 ? (
                  <div className="alert-bar warning">Capture at least one tank's opening dip above before entering delivery dips.</div>
                ) : (
                  <>
                    <CompartmentDipTable
                      rows={deliveryRows} setRows={setDeliveryRows}
                      showTankSelect tanks={tanks.filter((t) => dippedTanksWithOpening.has(t.id))}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                      <button className="btn btn-primary" onClick={handleSubmitDelivery} disabled={saving}>
                        {saving ? 'Saving…' : 'Record Delivery & Complete Trip'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* --- COMPLETED stage --- */}
            {trip.status === 'completed' && (
              <div>
                <div className="stats-grid" style={{ marginBottom: 16 }}>
                  <div className="stat-card"><div className="stat-label">Loaded</div><div className="stat-value">{Number(trip.loadedQty).toLocaleString()}L</div></div>
                  <div className="stat-card"><div className="stat-label">Delivered</div><div className="stat-value">{Number(trip.deliveredQty).toLocaleString()}L</div></div>
                  <div className="stat-card"><div className="stat-label">Transit Loss</div>
                    <div className="stat-value" style={{ color: trip.flagged ? 'var(--danger)' : 'var(--success)' }}>
                      {Number(trip.transitLoss).toLocaleString()}L ({Number(trip.lossPct).toFixed(2)}%)
                    </div>
                  </div>
                </div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Tank offload summary</div>
                <table className="data-table">
                  <thead><tr><th>Tank</th><th>Opening</th><th>Delivered</th><th>Sales During Offload</th><th>Expected Closing</th></tr></thead>
                  <tbody>
                    {offloadSummary.map((o) => (
                      <tr key={o.id}>
                        <td>{o.tank?.tankNo || '—'} <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>({o.tank?.product})</span></td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{Number(o.openingVolumeLiters).toLocaleString()}L</td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{Number(o.deliveredVolumeLiters).toLocaleString()}L</td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{Number(o.salesDuringOffloadLiters).toLocaleString()}L</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{Number(o.expectedClosingVolumeLiters).toLocaleString()}L</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                  Compare "Expected Closing" against this tank's next physical dip on the Tank Readings tab to spot loss at the tank.
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function CompartmentDipTable({ rows, setRows, showProduct, showTankSelect, tanks, extraLabel }) {
  const update = (i, field, value) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)))

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Comp.</th><th>Dip (cm)</th><th>Volume (L)</th>
          {showProduct && <th>{extraLabel}</th>}
          {showTankSelect && <th>Target Tank</th>}
          <th>Empty?</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={row.compartmentId}>
            <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{row.compartmentNo}</td>
            <td><input type="number" style={{ width: 90 }} disabled={row.isEmpty} value={row.dipCm} onChange={e => update(i, 'dipCm', e.target.value)} /></td>
            <td><input type="number" style={{ width: 110 }} disabled={row.isEmpty} value={row.volumeLiters} onChange={e => update(i, 'volumeLiters', e.target.value)} /></td>
            {showProduct && (
              <td>
                <select style={{ width: 100 }} disabled={row.isEmpty} value={row.product} onChange={e => update(i, 'product', e.target.value)}>
                  {['PMS','AGO','DPK','LPG','BIK'].map(p => <option key={p}>{p}</option>)}
                </select>
              </td>
            )}
            {showTankSelect && (
              <td>
                <select style={{ width: 160 }} disabled={row.isEmpty} value={row.tankId} onChange={e => update(i, 'tankId', e.target.value)}>
                  <option value="">Select…</option>
                  {tanks.map((t) => <option key={t.id} value={t.id}>{t.tankNo} ({t.product})</option>)}
                </select>
              </td>
            )}
            <td>
              <input type="checkbox" checked={row.isEmpty} onChange={e => update(i, 'isEmpty', e.target.checked)} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

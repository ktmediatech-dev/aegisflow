import React, { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { Plus, Search, Truck, MapPin, Gauge, Calendar, AlertTriangle, Navigation, Layers } from 'lucide-react'
import toast from 'react-hot-toast'

const STATUS = {
  'in-transit': { label: 'In Transit', cls: 'badge-success' },
  loading: { label: 'Loading', cls: 'badge-info' },
  delivered: { label: 'Delivered', cls: 'badge-muted' },
  idle: { label: 'Idle', cls: 'badge-muted' },
  maintenance: { label: 'Maintenance', cls: 'badge-warning' },
}

const emptyForm = { plate: '', type: 'Tanker', capacity: 33000, fuel: 'AGO', driver: '', station: '', status: 'idle', insurance: '', ownership: 'owned', ownerName: '' }

export default function Fleet() {
  const { fleet, addFleetVehicle, updateFleetVehicle, deleteFleetVehicle } = useStore()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editVeh, setEditVeh] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [compartmentsVeh, setCompartmentsVeh] = useState(null)

  const filtered = fleet.filter(v => {
    const q = search.toLowerCase()
    const match = v.plate.toLowerCase().includes(q) || v.driver.toLowerCase().includes(q) || v.type.toLowerCase().includes(q)
    return match && (filter === 'all' || v.status === filter)
  })

  const handleSave = async () => {
    if (form.ownership === 'hired' && !form.ownerName) {
      toast.error('Owner/transporter name is required for a hired vehicle')
      return
    }
    try {
      if (editVeh) {
        await updateFleetVehicle(editVeh.id, { ...form, capacity: Number(form.capacity) })
        toast.success('Vehicle updated')
      } else {
        await addFleetVehicle({ ...form, capacity: Number(form.capacity) })
        toast.success('Vehicle added')
      }
      setShowModal(false)
    } catch (err) {
      toast.error(err.message || 'Failed to save vehicle')
    }
  }

  const handleDelete = async (v) => {
    if (!window.confirm(`Request deletion of ${v.plate}? A second admin will need to approve it.`)) return
    try {
      await deleteFleetVehicle(v.id)
      toast.success('Deletion requested — pending approval')
    } catch (err) {
      toast.error(err.message || 'Failed to request deletion')
    }
  }

  const isServiceDue = (v) => {
    if (!v.nextService) return false
    return new Date(v.nextService) <= new Date(Date.now() + 30 * 86400000)
  }

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <div className="page-title">Fleet Management</div>
          <div className="page-subtitle">{fleet.length} vehicles · {fleet.filter(v => v.status === 'in-transit').length} in transit</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditVeh(null); setForm(emptyForm); setShowModal(true) }}>
          <Plus size={15} /> Add Vehicle
        </button>
      </div>

      {/* Status filter */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input style={{ paddingLeft: 34 }} placeholder="Search plate, driver…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="tab-bar" style={{ marginBottom: 0 }}>
          {['all','in-transit','loading','idle','maintenance','delivered'].map(f => (
            <button key={f} className={`tab-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)} style={{ fontSize: 11 }}>
              {f.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </button>
          ))}
        </div>
      </div>

      {/* Fleet table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Vehicle / Plate</th>
              <th>Type</th>
              <th>Ownership</th>
              <th>Driver</th>
              <th>Status</th>
              <th>Product</th>
              <th>Fuel Level</th>
              <th>Mileage</th>
              <th>Next Service</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(v => {
              const svcDue = isServiceDue(v)
              return (
                <tr key={v.id}>
                  <td>
                    <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{v.plate}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{v.id}</div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Truck size={13} color="var(--text-muted)" />
                      {v.type}
                    </div>
                    {v.capacity > 0 && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{v.capacity.toLocaleString()}L cap.</div>}
                  </td>
                  <td>
                    <span className={`badge ${v.ownership === 'hired' ? 'badge-warning' : 'badge-muted'}`}>{v.ownership || 'owned'}</span>
                    {v.ownership === 'hired' && v.ownerName && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{v.ownerName}</div>}
                  </td>
                  <td>{v.driver}</td>
                  <td><span className={`badge ${STATUS[v.status]?.cls}`}>{STATUS[v.status]?.label}</span></td>
                  <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--info)' }}>{v.fuel}</span></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="progress-bar" style={{ width: 60 }}>
                        <div className="progress-fill" style={{ width: `${v.fuelLevel}%`, background: v.fuelLevel < 20 ? 'var(--danger)' : v.fuelLevel < 40 ? 'var(--warning)' : 'var(--success)' }} />
                      </div>
                      <span style={{ fontSize: 12 }}>{v.fuelLevel}%</span>
                    </div>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{v.mileage.toLocaleString()} km</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      {svcDue && <AlertTriangle size={12} color="var(--warning)" />}
                      <span style={{ color: svcDue ? 'var(--warning)' : 'var(--text-secondary)', fontSize: 12 }}>{v.nextService}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setEditVeh(v); setForm({...emptyForm, ...v}); setShowModal(true) }}>Edit</button>
                      {v.type === 'Tanker' && (
                        <button className="btn btn-ghost btn-sm" onClick={() => setCompartmentsVeh(v)} title="Manage compartments">
                          <Layers size={13} />
                        </button>
                      )}
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(v)}>Delete</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-title">{editVeh ? 'Edit Vehicle' : 'Add Vehicle'}<button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[['plate','Plate Number'],['driver','Driver Name'],['station','Home Station']].map(([k,l]) => (
                <div key={k} className="form-group"><label className="form-label">{l}</label><input value={form[k]||''} onChange={e => setForm(p => ({...p,[k]:e.target.value}))} /></div>
              ))}
              <div className="form-group"><label className="form-label">Type</label>
                <select value={form.type} onChange={e => setForm(p => ({...p,type:e.target.value}))}>
                  {['Tanker','Service Van','Pickup','Truck'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Capacity (L)</label><input type="number" value={form.capacity} onChange={e => setForm(p => ({...p,capacity:e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">Fuel Type</label>
                <select value={form.fuel} onChange={e => setForm(p => ({...p,fuel:e.target.value}))}>
                  {['PMS','AGO','DPK','LPG'].map(f => <option key={f}>{f}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Status</label>
                <select value={form.status} onChange={e => setForm(p => ({...p,status:e.target.value}))}>
                  {['idle','in-transit','loading','delivered','maintenance'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Insurance Expiry</label><input type="date" value={form.insurance||''} onChange={e => setForm(p => ({...p,insurance:e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">Ownership</label>
                <select value={form.ownership} onChange={e => setForm(p => ({...p,ownership:e.target.value}))}>
                  <option value="owned">Owned</option>
                  <option value="hired">Hired</option>
                </select>
              </div>
              {form.ownership === 'hired' && (
                <div className="form-group"><label className="form-label">Owner / Transporter Name</label><input value={form.ownerName||''} onChange={e => setForm(p => ({...p,ownerName:e.target.value}))} placeholder="e.g. Speedy Transporters Ltd" /></div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>Save</button>
            </div>
          </div>
        </div>
      )}

      {compartmentsVeh && (
        <CompartmentsModal vehicle={compartmentsVeh} onClose={() => setCompartmentsVeh(null)} />
      )}
    </div>
  )
}

function CompartmentsModal({ vehicle, onClose }) {
  const { fetchVehicleCompartments, saveVehicleCompartments } = useStore()
  const [rows, setRows] = useState([{ compartmentNo: 1, capacity: '' }])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  React.useEffect(() => {
    fetchVehicleCompartments(vehicle.id)
      .then((data) => {
        if (data.length) setRows(data.map((c) => ({ compartmentNo: c.compartmentNo, capacity: c.capacity })))
      })
      .finally(() => setLoading(false))
  }, [vehicle.id, fetchVehicleCompartments])

  const addRow = () => setRows((r) => [...r, { compartmentNo: r.length + 1, capacity: '' }])
  const removeRow = (i) => setRows((r) => r.filter((_, idx) => idx !== i))
  const updateRow = (i, field, value) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)))

  const handleSave = async () => {
    const valid = rows.filter((r) => r.compartmentNo && r.capacity)
    if (!valid.length) {
      toast.error('Add at least one compartment with a number and capacity')
      return
    }
    setSaving(true)
    try {
      await saveVehicleCompartments(vehicle.id, valid.map((r) => ({ compartmentNo: Number(r.compartmentNo), capacity: Number(r.capacity) })))
      toast.success('Compartments saved')
      onClose()
    } catch (err) {
      toast.error(err.message || 'Failed to save compartments')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">Compartments — {vehicle.plate}<button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button></div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
          Register each compartment as physically labeled on the truck (1, 2, 3, ...) with its nominal capacity in liters.
          Trucks vary — some have 3 compartments, some have 10+.
        </div>
        {loading ? (
          <div style={{ color: 'var(--text-muted)' }}>Loading…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map((row, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label className="form-label">Compartment No.</label>
                  <input type="number" min={1} value={row.compartmentNo} onChange={e => updateRow(i, 'compartmentNo', e.target.value)} />
                </div>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label className="form-label">Capacity (L)</label>
                  <input type="number" min={0} value={row.capacity} onChange={e => updateRow(i, 'capacity', e.target.value)} />
                </div>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', marginTop: 18 }} onClick={() => removeRow(i)}>Remove</button>
              </div>
            ))}
            <button className="btn btn-secondary btn-sm" onClick={addRow} style={{ alignSelf: 'flex-start' }}><Plus size={13} /> Add Compartment</button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Compartments'}</button>
        </div>
      </div>
    </div>
  )
}

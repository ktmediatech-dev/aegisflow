import React, { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { Plus, Search, Truck, MapPin, Gauge, Calendar, AlertTriangle, Navigation } from 'lucide-react'
import toast from 'react-hot-toast'

const STATUS = {
  'in-transit': { label: 'In Transit', cls: 'badge-success' },
  loading: { label: 'Loading', cls: 'badge-info' },
  delivered: { label: 'Delivered', cls: 'badge-muted' },
  idle: { label: 'Idle', cls: 'badge-muted' },
  maintenance: { label: 'Maintenance', cls: 'badge-warning' },
}

export default function Fleet() {
  const { fleet, addFleetVehicle, updateFleetVehicle, deleteFleetVehicle } = useStore()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editVeh, setEditVeh] = useState(null)
  const [form, setForm] = useState({ plate: '', type: 'Tanker', capacity: 33000, fuel: 'AGO', driver: '', station: '', status: 'idle', insurance: '' })

  const filtered = fleet.filter(v => {
    const q = search.toLowerCase()
    const match = v.plate.toLowerCase().includes(q) || v.driver.toLowerCase().includes(q) || v.type.toLowerCase().includes(q)
    return match && (filter === 'all' || v.status === filter)
  })

  const handleSave = async () => {
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
        <button className="btn btn-primary" onClick={() => { setEditVeh(null); setForm({ plate:'',type:'Tanker',capacity:33000,fuel:'AGO',driver:'',station:'',status:'idle',insurance:'' }); setShowModal(true) }}>
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
              <th>Driver</th>
              <th>Status</th>
              <th>Product</th>
              <th>Fuel Level</th>
              <th>Mileage</th>
              <th>Next Service</th>
              <th>Speed</th>
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
                    {v.speed > 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Navigation size={12} color="var(--success)" />
                        <span style={{ fontSize: 12, color: 'var(--success)' }}>{v.speed} km/h</span>
                      </div>
                    ) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setEditVeh(v); setForm({...v}); setShowModal(true) }}>Edit</button>
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
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

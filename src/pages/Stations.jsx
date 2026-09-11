import React, { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { Plus, MapPin, Search, Fuel, Users, Activity, MoreVertical, Edit, Trash2, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency } from '../utils/currency.js'

const STATUS_CONFIG = {
  operational: { label: 'Operational', cls: 'badge-success' },
  maintenance: { label: 'Maintenance', cls: 'badge-warning' },
  suspended: { label: 'Suspended', cls: 'badge-danger' },
}

export default function Stations() {
  const { stations, addStation, updateStation, deleteStation, currency } = useStore()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editStation, setEditStation] = useState(null)
  const [form, setForm] = useState({ name: '', region: '', manager: '', address: '', phone: '', fuelTypes: 'PMS,AGO', tanks: 2, pumps: 4, status: 'operational', salesTarget: '' })

  const filtered = stations.filter(s => {
    const q = search.toLowerCase()
    const matchSearch = s.name.toLowerCase().includes(q) || s.region.toLowerCase().includes(q) || s.manager.toLowerCase().includes(q)
    const matchFilter = filter === 'all' || s.status === filter
    return matchSearch && matchFilter
  })

  const openAdd = () => { setEditStation(null); setForm({ name: '', region: '', manager: '', address: '', phone: '', fuelTypes: 'PMS,AGO', tanks: 2, pumps: 4, status: 'operational', salesTarget: '' }); setShowModal(true) }
  const openEdit = (s) => { setEditStation(s); setForm({ ...s, fuelTypes: s.fuelTypes.join(','), salesTarget: s.salesTarget ?? '' }); setShowModal(true) }

  const handleSave = async () => {
    const payload = { ...form, fuelTypes: form.fuelTypes.split(',').map(f => f.trim()), tanks: Number(form.tanks), pumps: Number(form.pumps), salesTarget: form.salesTarget === '' ? null : Number(form.salesTarget) }
    try {
      if (editStation) { await updateStation(editStation.id, payload); toast.success('Station updated') }
      else { await addStation(payload); toast.success('Station added') }
      setShowModal(false)
    } catch (err) {
      toast.error(err.message || 'Failed to save station')
    }
  }

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Request deletion of ${name}? A second admin will need to approve it before it's removed.`)) return
    try {
      await deleteStation(id)
      toast.success('Deletion requested — pending approval')
    } catch (err) {
      toast.error(err.message || 'Failed to request deletion')
    }
  }

  const getRiskColor = (score) => score >= 60 ? 'var(--danger)' : score >= 30 ? 'var(--warning)' : 'var(--success)'

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <div className="page-title">Stations</div>
          <div className="page-subtitle">{stations.length} stations across {[...new Set(stations.map(s => s.region))].length} regions</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={15} /> Add Station</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input style={{ paddingLeft: 34 }} placeholder="Search stations…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="tab-bar" style={{ marginBottom: 0 }}>
          {['all','operational','maintenance','suspended'].map(f => (
            <button key={f} className={`tab-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Station cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
        {filtered.map(station => (
          <div key={station.id} className="card card-hover" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>{station.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)', fontSize: 12 }}>
                  <MapPin size={11} /> {station.address}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className={`badge ${STATUS_CONFIG[station.status]?.cls}`}>{STATUS_CONFIG[station.status]?.label}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-ghost btn-sm" style={{ padding: '4px 6px' }} onClick={() => openEdit(station)} title="Edit"><Edit size={13} /></button>
                  <button className="btn btn-ghost btn-sm" style={{ padding: '4px 6px', color: 'var(--danger)' }} onClick={() => handleDelete(station.id, station.name)} title="Delete"><Trash2 size={13} /></button>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              <Metric label="Region" value={station.region} />
              <Metric label="Manager" value={station.manager} />
              <Metric label="Tanks" value={station.tanks} />
              <Metric label="Pumps" value={station.pumps} />
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
              {station.fuelTypes.map(f => (
                <span key={f} style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{f}</span>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Monthly Sales</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                  {formatCurrency(station.monthlySales, currency, { compact: false })}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Risk Score</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: getRiskColor(station.riskScore) }}>{station.riskScore}/100</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-title">
              {editStation ? 'Edit Station' : 'Add New Station'}
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[['name','Station Name'],['region','Region'],['manager','Manager'],['address','Address'],['phone','Phone'],['fuelTypes','Fuel Types (comma-sep)']].map(([key,label]) => (
                <div key={key} className="form-group" style={{ gridColumn: key === 'address' ? 'span 2' : 'span 1' }}>
                  <label className="form-label">{label}</label>
                  <input value={form[key] || ''} onChange={e => setForm(p => ({...p, [key]: e.target.value}))} />
                </div>
              ))}
              <div className="form-group">
                <label className="form-label">Tanks</label>
                <input type="number" min={1} value={form.tanks} onChange={e => setForm(p => ({...p, tanks: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Pumps</label>
                <input type="number" min={1} value={form.pumps} onChange={e => setForm(p => ({...p, pumps: e.target.value}))} />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Monthly Sales Target (optional — used by Analytics)</label>
                <input type="number" min={0} value={form.salesTarget} onChange={e => setForm(p => ({...p, salesTarget: e.target.value}))} placeholder="e.g. 1500000" />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Status</label>
                <select value={form.status} onChange={e => setForm(p => ({...p, status: e.target.value}))}>
                  <option value="operational">Operational</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>Save Station</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Metric({ label, value }) {
  return (
    <div style={{ background: 'var(--bg-raised)', borderRadius: 8, padding: '7px 10px' }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{value}</div>
    </div>
  )
}

import React, { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { Plus, Search, Star, Phone, Mail, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency } from '../utils/currency.js'

export default function Contractors() {
  const { contractors, addContractor, updateContractor, deleteContractor, currency } = useStore()
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editC, setEditC] = useState(null)
  const [form, setForm] = useState({ name:'',contact:'',email:'',phone:'',speciality:'',region:'',contract:'',expiry:'',status:'active' })

  const filtered = contractors.filter(c => {
    const q = search.toLowerCase()
    return c.name.toLowerCase().includes(q) || c.speciality.toLowerCase().includes(q) || c.region.toLowerCase().includes(q)
  })

  const handleSave = async () => {
    try {
      if (editC) { await updateContractor(editC.id, form); toast.success('Contractor updated') }
      else { await addContractor(form); toast.success('Contractor added') }
      setShowModal(false)
    } catch (err) {
      toast.error(err.message || 'Failed to save contractor')
    }
  }

  const isExpiring = (expiry) => expiry && new Date(expiry) <= new Date(Date.now() + 60 * 86400000)

  const handleDelete = async (c) => {
    if (!window.confirm(`Request deletion of ${c.name}? A second admin will need to approve it.`)) return
    try {
      await deleteContractor(c.id)
      toast.success('Deletion requested — pending approval')
    } catch (err) {
      toast.error(err.message || 'Failed to request deletion')
    }
  }

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <div className="page-title">Contractors & Service Providers</div>
          <div className="page-subtitle">{contractors.length} contractors · {contractors.filter(c => c.activeJobs > 0).length} currently active</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditC(null); setForm({ name:'',contact:'',email:'',phone:'',speciality:'',region:'',contract:'',expiry:'',status:'active' }); setShowModal(true) }}>
          <Plus size={15} /> Add Contractor
        </button>
      </div>

      <div style={{ position: 'relative', marginBottom: 20, maxWidth: 400 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input style={{ paddingLeft: 34 }} placeholder="Search contractors…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
        {filtered.map(c => {
          const expiring = isExpiring(c.expiry)
          return (
            <div key={c.id} className="card" style={{ borderTop: `2px solid ${c.status === 'active' ? 'var(--success)' : c.status === 'expiring' ? 'var(--warning)' : 'var(--danger)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.speciality} · {c.region}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-raised)', padding: '4px 10px', borderRadius: 8, height: 'fit-content' }}>
                  <Star size={12} color="#f5a623" fill="#f5a623" />
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{c.rating}</span>
                </div>
              </div>

              {expiring && (
                <div className="alert-bar warning" style={{ marginBottom: 10, padding: '6px 10px', fontSize: 11 }}>
                  <AlertTriangle size={12} /> Contract expires {c.expiry} — renewal required
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                <InfoBox label="Contact" value={c.contact} />
                <InfoBox label="Active Jobs" value={c.activeJobs} />
                <InfoBox label="Completed" value={c.completedJobs} />
                <InfoBox label="Total Paid" value={formatCurrency(c.totalPaid, currency)} />
              </div>

              {c.certifications?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
                  {c.certifications.map(cert => (
                    <span key={cert} style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', background: 'var(--info-dim)', color: 'var(--info)', borderRadius: 4 }}>{cert}</span>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={11} />{c.phone}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Mail size={11} />{c.email}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Contract: {c.contract} → <strong style={{ color: expiring ? 'var(--warning)' : 'var(--text-secondary)' }}>{c.expiry}</strong></div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setEditC(c); setForm({...c}); setShowModal(true) }}>Edit</button>
                  <button className="btn btn-secondary btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(c)}>Delete</button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-title">{editC ? 'Edit Contractor' : 'Add Contractor'}<button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[['name','Company Name',2],['contact','Primary Contact',1],['email','Email',1],['phone','Phone',1],['speciality','Speciality',1],['region','Region',1]].map(([k,l,span]) => (
                <div key={k} className="form-group" style={{ gridColumn: `span ${span}` }}>
                  <label className="form-label">{l}</label>
                  <input value={form[k]||''} onChange={e => setForm(p => ({...p,[k]:e.target.value}))} />
                </div>
              ))}
              <div className="form-group"><label className="form-label">Contract Start</label><input type="date" value={form.contract||''} onChange={e => setForm(p => ({...p,contract:e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">Contract Expiry</label><input type="date" value={form.expiry||''} onChange={e => setForm(p => ({...p,expiry:e.target.value}))} /></div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Status</label>
                <select value={form.status} onChange={e => setForm(p => ({...p,status:e.target.value}))}>
                  <option value="active">Active</option><option value="expiring">Expiring</option><option value="inactive">Inactive</option>
                </select>
              </div>
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

function InfoBox({ label, value }) {
  return (
    <div style={{ background: 'var(--bg-raised)', borderRadius: 7, padding: '6px 10px' }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 1 }}>{value}</div>
    </div>
  )
}

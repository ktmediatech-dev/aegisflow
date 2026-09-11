import React, { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { Plus, Search, Package, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency } from '../utils/currency.js'

export default function Suppliers() {
  const { suppliers, addSupplier, updateSupplier, deleteSupplier, currency } = useStore()
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editS, setEditS] = useState(null)
  const [form, setForm] = useState({ name:'',shortCode:'',contact:'',email:'',phone:'',products:'',paymentTerms:'Net 30',creditLimit:10000000,status:'active',deliveryLeadTime:3 })

  const filtered = suppliers.filter(s => {
    const q = search.toLowerCase()
    return s.name.toLowerCase().includes(q) || s.shortCode.toLowerCase().includes(q)
  })

  const handleSave = async () => {
    const payload = { ...form, creditLimit: Number(form.creditLimit), deliveryLeadTime: Number(form.deliveryLeadTime), products: typeof form.products === 'string' ? form.products.split(',').map(p => p.trim()) : form.products }
    try {
      if (editS) { await updateSupplier(editS.id, payload); toast.success('Supplier updated') }
      else { await addSupplier(payload); toast.success('Supplier added') }
      setShowModal(false)
    } catch (err) {
      toast.error(err.message || 'Failed to save supplier')
    }
  }

  const totalOwed = suppliers.reduce((s, sup) => s + (sup.currentBalance || 0), 0)

  const handleDelete = async (s) => {
    if (!window.confirm(`Request deletion of ${s.name}? A second admin will need to approve it.`)) return
    try {
      await deleteSupplier(s.id)
      toast.success('Deletion requested — pending approval')
    } catch (err) {
      toast.error(err.message || 'Failed to request deletion')
    }
  }

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <div className="page-title">Suppliers</div>
          <div className="page-subtitle">{suppliers.length} fuel and product suppliers</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditS(null); setForm({ name:'',shortCode:'',contact:'',email:'',phone:'',products:'',paymentTerms:'Net 30',creditLimit:10000000,status:'active',deliveryLeadTime:3 }); setShowModal(true) }}>
          <Plus size={15} /> Add Supplier
        </button>
      </div>

      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card"><div className="stat-label">Total Suppliers</div><div className="stat-value">{suppliers.length}</div></div>
        <div className="stat-card"><div className="stat-label">Total Outstanding</div><div className="stat-value">{formatCurrency(totalOwed, currency)}</div></div>
        <div className="stat-card"><div className="stat-label">Total Purchases YTD</div><div className="stat-value">{formatCurrency(suppliers.reduce((s,sup) => s+(sup.totalPurchases||0),0), currency)}</div></div>
      </div>

      <div style={{ position: 'relative', marginBottom: 20, maxWidth: 400 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input style={{ paddingLeft: 34 }} placeholder="Search suppliers…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr><th>Supplier</th><th>Products</th><th>Contact</th><th>Payment Terms</th><th>Credit Limit</th><th>Balance Due</th><th>Last Delivery</th><th>Lead Time</th><th>Rating</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.map(s => {
              const utilizationPct = Math.round((s.currentBalance / s.creditLimit) * 100)
              return (
                <tr key={s.id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{s.name}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)' }}>{s.shortCode}</div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                      {(Array.isArray(s.products) ? s.products : [s.products]).map(p => (
                        <span key={p} style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)', background: 'var(--accent-dim)', color: 'var(--accent)', padding: '1px 6px', borderRadius: 4 }}>{p}</span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{s.contact}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.email}</div>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{s.paymentTerms}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{formatCurrency(s.creditLimit, currency)}</td>
                  <td>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: utilizationPct > 80 ? 'var(--warning)' : 'var(--text-secondary)' }}>
                      {formatCurrency(s.currentBalance, currency)}
                    </div>
                    <div className="progress-bar" style={{ width: 60, marginTop: 4 }}>
                      <div className="progress-fill" style={{ width: `${utilizationPct}%`, background: utilizationPct > 80 ? 'var(--warning)' : 'var(--success)' }} />
                    </div>
                  </td>
                  <td style={{ fontSize: 12 }}>{s.lastDelivery || '—'}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{s.deliveryLeadTime} day{s.deliveryLeadTime > 1 ? 's' : ''}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {'★'.repeat(Math.round(s.rating))}
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.rating}</span>
                    </div>
                  </td>
                  <td><span className={`badge ${s.status === 'active' ? 'badge-success' : 'badge-warning'}`}>{s.status}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setEditS(s); setForm({...s, products: Array.isArray(s.products) ? s.products.join(',') : s.products}); setShowModal(true) }}>Edit</button>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(s)}>Delete</button>
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
            <div className="modal-title">{editS ? 'Edit Supplier' : 'Add Supplier'}<button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group" style={{ gridColumn:'span 2' }}><label className="form-label">Company Name</label><input value={form.name||''} onChange={e => setForm(p => ({...p,name:e.target.value}))} /></div>
              {[['shortCode','Short Code'],['contact','Contact Name'],['email','Email'],['phone','Phone']].map(([k,l]) => (
                <div key={k} className="form-group"><label className="form-label">{l}</label><input value={form[k]||''} onChange={e => setForm(p => ({...p,[k]:e.target.value}))} /></div>
              ))}
              <div className="form-group" style={{ gridColumn:'span 2' }}><label className="form-label">Products (comma-separated)</label><input value={form.products||''} onChange={e => setForm(p => ({...p,products:e.target.value}))} placeholder="PMS, AGO, DPK" /></div>
              <div className="form-group"><label className="form-label">Payment Terms</label><input value={form.paymentTerms||''} onChange={e => setForm(p => ({...p,paymentTerms:e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">Credit Limit (KES)</label><input type="number" value={form.creditLimit||''} onChange={e => setForm(p => ({...p,creditLimit:e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">Lead Time (days)</label><input type="number" value={form.deliveryLeadTime||''} onChange={e => setForm(p => ({...p,deliveryLeadTime:e.target.value}))} /></div>
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

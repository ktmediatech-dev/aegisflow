import React, { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Users() {
  const { companyUsers, companyRoles, stations, createUser, updateUser } = useStore()
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', roleId: '', stationId: '' })

  const openAdd = () => { setForm({ name: '', email: '', password: '', roleId: '', stationId: '' }); setShowModal(true) }

  const handleSave = async () => {
    if (!form.name || !form.email || !form.password || !form.roleId) {
      toast.error('Name, email, password and role are required')
      return
    }
    try {
      await createUser({ ...form, stationId: form.stationId || null })
      toast.success('User created')
      setShowModal(false)
    } catch (err) {
      toast.error(err.message || 'Failed to create user')
    }
  }

  const handleToggleStatus = async (u) => {
    try {
      await updateUser(u.id, { status: u.status === 'active' ? 'disabled' : 'active' })
      toast.success('User updated')
    } catch (err) {
      toast.error(err.message || 'Failed to update user')
    }
  }

  return (
    <div className="page-card">
      <div className="page-header">
        <div>
          <div className="page-title">Company Users</div>
          <div className="page-subtitle">Manage users and assign roles — optionally scope a user to a single station.</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={15} /> Add User</button>
      </div>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Station</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {companyUsers.map(user => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>{user.role_name || user.role}</td>
                <td>{user.station_name || <span style={{ color: 'var(--text-muted)' }}>Company-wide</span>}</td>
                <td><span className={`badge ${user.status === 'active' ? 'badge-success' : 'badge-muted'}`}>{user.status}</span></td>
                <td>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleToggleStatus(user)}>
                    {user.status === 'active' ? 'Disable' : 'Enable'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-title">Add User<button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group"><label className="form-label">Full Name</label><input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Email</label><input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Temporary Password</label><input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} /></div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select value={form.roleId} onChange={e => setForm(p => ({ ...p, roleId: e.target.value }))}>
                  <option value="">Select role…</option>
                  {companyRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Station (optional — leave blank for company-wide access)</label>
                <select value={form.stationId} onChange={e => setForm(p => ({ ...p, stationId: e.target.value }))}>
                  <option value="">Company-wide</option>
                  {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>Create User</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import React, { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { Plus, Search, AlertTriangle, Clock, CheckCircle, Wrench, Bell } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency } from '../utils/currency.js'

const STATUS_CFG = {
  scheduled: { label: 'Scheduled', cls: 'badge-info', icon: Clock },
  'in-progress': { label: 'In Progress', cls: 'badge-warning', icon: Wrench },
  completed: { label: 'Completed', cls: 'badge-success', icon: CheckCircle },
  overdue: { label: 'Overdue', cls: 'badge-danger', icon: AlertTriangle },
}
const PRIORITY_CFG = {
  critical: { cls: 'badge-danger' },
  high: { cls: 'badge-warning' },
  medium: { cls: 'badge-info' },
  low: { cls: 'badge-muted' },
}

export default function Maintenance() {
  const { maintenanceJobs, addMaintenanceJob, updateMaintenanceJob, contractors, stations, currency } = useStore()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editJob, setEditJob] = useState(null)
  const [form, setForm] = useState({ station: '', type: '', description: '', priority: 'medium', status: 'scheduled', contractorId: '', assignedTech: '', scheduledDate: '', estimatedCompletion: '', cost: '' })

  const filtered = maintenanceJobs.filter(j => {
    const q = search.toLowerCase()
    const match = j.station?.toLowerCase().includes(q) || j.type.toLowerCase().includes(q) || j.assignedTech?.toLowerCase().includes(q)
    return match && (filter === 'all' || j.status === filter)
  })

  const handleSave = async () => {
    const payload = { ...form, cost: Number(form.cost) || 0 }
    try {
      if (editJob) { await updateMaintenanceJob(editJob.id, payload); toast.success('Job updated') }
      else { await addMaintenanceJob(payload); toast.success('Job created') }
      setShowModal(false)
    } catch (err) {
      toast.error(err.message || 'Failed to save job')
    }
  }

  const sendReminder = (job) => {
    toast.success(`Reminder sent to ${job.assignedTech || job.contractorId || 'contractor'} for: ${job.type}`)
  }

  const overdueCnt = maintenanceJobs.filter(j => j.status === 'overdue').length
  const inProgressCnt = maintenanceJobs.filter(j => j.status === 'in-progress').length
  const totalCost = maintenanceJobs.filter(j => j.status !== 'overdue').reduce((s, j) => s + (j.cost || 0), 0)

  return (
    <div className="animate-fadeIn">
      {overdueCnt > 0 && (
        <div className="alert-bar danger" style={{ marginBottom: 20 }}>
          <AlertTriangle size={16} /> <strong>{overdueCnt} overdue maintenance job{overdueCnt > 1 ? 's' : ''}.</strong> These require immediate scheduling.
        </div>
      )}

      <div className="page-header">
        <div>
          <div className="page-title">Maintenance</div>
          <div className="page-subtitle">{maintenanceJobs.length} jobs · {inProgressCnt} in progress</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditJob(null); setForm({ station:'',type:'',description:'',priority:'medium',status:'scheduled',contractorId:'',assignedTech:'',scheduledDate:'',estimatedCompletion:'',cost:'' }); setShowModal(true) }}>
          <Plus size={15} /> New Job
        </button>
      </div>

      <div className="stats-grid" style={{ marginBottom: 20 }}>
        {[
          { label: 'Total Jobs', value: maintenanceJobs.length, color: 'var(--text-primary)' },
          { label: 'In Progress', value: inProgressCnt, color: 'var(--warning)' },
          { label: 'Overdue', value: overdueCnt, color: 'var(--danger)' },
          { label: 'Est. Total Cost', value: formatCurrency(totalCost, currency), color: 'var(--info)' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input style={{ paddingLeft: 34 }} placeholder="Search jobs…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="tab-bar" style={{ marginBottom: 0 }}>
          {['all','scheduled','in-progress','overdue','completed'].map(f => (
            <button key={f} className={`tab-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)} style={{ fontSize: 11 }}>
              {f.replace('-',' ').replace(/\b\w/g, c => c.toUpperCase())}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.map(job => {
          const StatusIcon = STATUS_CFG[job.status]?.icon || Wrench
          return (
            <div key={job.id} className="card" style={{ borderLeft: `3px solid ${job.priority === 'critical' ? 'var(--danger)' : job.priority === 'high' ? 'var(--warning)' : job.priority === 'medium' ? 'var(--accent)' : 'var(--border)'}` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{job.type}</span>
                    <span className={`badge ${PRIORITY_CFG[job.priority]?.cls}`}>{job.priority}</span>
                    <span className={`badge ${STATUS_CFG[job.status]?.cls}`}><StatusIcon size={10} /> {STATUS_CFG[job.status]?.label}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{job.id}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>{job.description}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, fontSize: 12 }}>
                    <InfoItem label="Station" value={job.station || job.vehicleId || '—'} />
                    <InfoItem label="Technician" value={job.assignedTech || '—'} />
                    <InfoItem label="Scheduled" value={job.scheduledDate} />
                    <InfoItem label="Est. Completion" value={job.estimatedCompletion} />
                    {job.actualCompletion && <InfoItem label="Completed" value={job.actualCompletion} />}
                    <InfoItem label="Cost" value={job.cost ? formatCurrency(job.cost, currency, { compact: false }) : 'TBD'} />
                    {job.invoiceNo && <InfoItem label="Invoice" value={job.invoiceNo} />}
                  </div>
                  {job.notes && (
                    <div style={{ marginTop: 8, fontSize: 12, background: 'var(--bg-raised)', padding: '6px 10px', borderRadius: 6, color: 'var(--text-secondary)', borderLeft: '2px solid var(--border-bright)' }}>
                      {job.notes}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setEditJob(job); setForm({...job, cost: String(job.cost||'')}); setShowModal(true) }}>Edit</button>
                  {job.status !== 'completed' && (
                    <button className="btn btn-ghost btn-sm" onClick={() => sendReminder(job)} style={{ color: 'var(--accent)' }}>
                      <Bell size={12} /> Remind
                    </button>
                  )}
                  {job.status === 'in-progress' && (
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--success)' }}
                      onClick={async () => {
                        try {
                          await updateMaintenanceJob(job.id, { status: 'completed', actualCompletion: new Date().toISOString().slice(0,10) })
                          toast.success('Job marked complete')
                        } catch (err) {
                          toast.error(err.message || 'Failed to update job')
                        }
                      }}>
                      ✓ Complete
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-title">{editJob ? 'Edit Job' : 'New Maintenance Job'}<button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Station / Vehicle</label>
                <select value={form.station} onChange={e => setForm(p => ({...p, station: e.target.value}))}>
                  <option value="">Select station…</option>
                  {stations.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Job Type</label><input value={form.type} onChange={e => setForm(p => ({...p, type: e.target.value}))} placeholder="e.g. Pump Repair" /></div>
              <div className="form-group"><label className="form-label">Assigned Technician</label><input value={form.assignedTech} onChange={e => setForm(p => ({...p, assignedTech: e.target.value}))} /></div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}><label className="form-label">Description</label><textarea rows={3} value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">Priority</label>
                <select value={form.priority} onChange={e => setForm(p => ({...p, priority: e.target.value}))}>
                  {['critical','high','medium','low'].map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Status</label>
                <select value={form.status} onChange={e => setForm(p => ({...p, status: e.target.value}))}>
                  {['scheduled','in-progress','overdue','completed'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Scheduled Date</label><input type="date" value={form.scheduledDate} onChange={e => setForm(p => ({...p, scheduledDate: e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">Est. Completion</label><input type="date" value={form.estimatedCompletion} onChange={e => setForm(p => ({...p, estimatedCompletion: e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">Estimated Cost (KES — base currency)</label><input type="number" value={form.cost} onChange={e => setForm(p => ({...p, cost: e.target.value}))} /></div>
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

function InfoItem({ label, value }) {
  return (
    <div>
      <span style={{ color: 'var(--text-muted)' }}>{label}: </span>
      <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{value}</span>
    </div>
  )
}

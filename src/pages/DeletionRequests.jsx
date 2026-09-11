import React, { useEffect, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { Trash2, Check, X, Clock } from 'lucide-react'
import toast from 'react-hot-toast'

const STATUS_CFG = {
  pending: { label: 'Pending', cls: 'badge-warning' },
  approved: { label: 'Approved', cls: 'badge-danger' },
  rejected: { label: 'Rejected', cls: 'badge-muted' },
}

export default function DeletionRequests() {
  const { deletionRequests, fetchDeletionRequests, approveDeletionRequest, rejectDeletionRequest, user } = useStore()
  const [filter, setFilter] = useState('pending')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDeletionRequests().finally(() => setLoading(false))
  }, [fetchDeletionRequests])

  const filtered = deletionRequests.filter((r) => filter === 'all' || r.status === filter)
  const pendingCount = deletionRequests.filter((r) => r.status === 'pending').length

  const isOwnRequest = (r) => String(r.requestedBy) === String(user?.id)

  const handleApprove = async (r) => {
    if (!window.confirm(`Permanently delete this ${r.module.slice(0, -1)}? This cannot be undone.`)) return
    try {
      await approveDeletionRequest(r.id)
      toast.success('Approved — record deleted')
    } catch (err) {
      toast.error(err.message || 'Failed to approve')
    }
  }

  const handleReject = async (r) => {
    try {
      await rejectDeletionRequest(r.id)
      toast.success('Request rejected')
    } catch (err) {
      toast.error(err.message || 'Failed to reject')
    }
  }

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <div className="page-title">Deletion Requests</div>
          <div className="page-subtitle">
            {pendingCount} pending · every deletion needs a second approver who isn't the requester
          </div>
        </div>
      </div>

      <div className="tab-bar" style={{ marginBottom: 20 }}>
        {['pending', 'approved', 'rejected', 'all'].map((f) => (
          <button key={f} className={`tab-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? (
          <div className="empty-state"><Clock size={28} /><div>Loading…</div></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><Trash2 size={28} /><div>No {filter !== 'all' ? filter : ''} deletion requests</div></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map((r) => (
              <div key={r.id} className="card" style={{ borderLeft: `3px solid ${r.status === 'pending' ? 'var(--warning)' : r.status === 'approved' ? 'var(--danger)' : 'var(--border)'}` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{r.recordLabel || r.recordId}</span>
                      <span className="badge badge-muted" style={{ textTransform: 'uppercase', fontSize: 10 }}>{r.module}</span>
                      <span className={`badge ${STATUS_CFG[r.status]?.cls}`}>{STATUS_CFG[r.status]?.label}</span>
                    </div>
                    {r.reason && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Reason: {r.reason}</div>}
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Requested {new Date(r.createdAt).toLocaleString()}
                      {r.resolvedAt && ` · Resolved ${new Date(r.resolvedAt).toLocaleString()}`}
                    </div>
                  </div>
                  {r.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      {isOwnRequest(r) ? (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>Awaiting another admin</span>
                      ) : (
                        <>
                          <button className="btn btn-secondary btn-sm" style={{ color: 'var(--success)' }} onClick={() => handleApprove(r)}>
                            <Check size={13} /> Approve
                          </button>
                          <button className="btn btn-secondary btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleReject(r)}>
                            <X size={13} /> Reject
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

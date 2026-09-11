import React from 'react'
import { useStore } from '../store/useStore.js'

export default function Compliance() {
  const { complianceCases } = useStore()
  const openCases = complianceCases.filter(item => item.status === 'open' || item.status === 'in-progress').length
  const critical = complianceCases.filter(item => item.priority === 'critical').length
  const assigned = complianceCases.filter(item => item.assigned_to).length

  return (
    <div className="page-card">
      <div className="page-header">
        <div>
          <div className="page-title">Compliance & Fraud</div>
          <div className="page-subtitle">Monitor compliance cases, approvals, and fraud investigations.</div>
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div className="card card-metric">
          <div className="metric-label">Active cases</div>
          <div className="metric-value">{openCases}</div>
        </div>
        <div className="card card-metric">
          <div className="metric-label">Critical issues</div>
          <div className="metric-value">{critical}</div>
        </div>
        <div className="card card-metric">
          <div className="metric-label">Assigned cases</div>
          <div className="metric-value">{assigned}</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Category</th>
              <th>Assigned To</th>
              <th>Priority</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {complianceCases.map(item => (
              <tr key={item.id}>
                <td>{item.title}</td>
                <td>{item.category}</td>
                <td>{item.assigned_to || 'Unassigned'}</td>
                <td>{item.priority}</td>
                <td>{item.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

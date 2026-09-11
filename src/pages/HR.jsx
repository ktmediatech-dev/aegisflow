import React from 'react'
import { useStore } from '../store/useStore.js'

export default function HR() {
  const { hrEmployees } = useStore()
  const total = hrEmployees.length
  const active = hrEmployees.filter(e => e.status === 'active').length
  const departments = [...new Set(hrEmployees.map(e => e.department))].length

  return (
    <div className="page-card">
      <div className="page-header">
        <div>
          <div className="page-title">HR Management</div>
          <div className="page-subtitle">Track employees, roles, and headcount across the business.</div>
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div className="card card-metric">
          <div className="metric-label">Total employees</div>
          <div className="metric-value">{total}</div>
        </div>
        <div className="card card-metric">
          <div className="metric-label">Active staff</div>
          <div className="metric-value">{active}</div>
        </div>
        <div className="card card-metric">
          <div className="metric-label">Departments</div>
          <div className="metric-value">{departments}</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Department</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {hrEmployees.map(emp => (
              <tr key={emp.id}>
                <td>{emp.name}</td>
                <td>{emp.email}</td>
                <td>{emp.role}</td>
                <td>{emp.department}</td>
                <td>{emp.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

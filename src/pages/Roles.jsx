import React from 'react'
import { useStore } from '../store/useStore.js'

export default function Roles() {
  const { companyRoles } = useStore()

  return (
    <div className="page-card">
      <div className="page-header">
        <div>
          <div className="page-title">Roles & Permissions</div>
          <div className="page-subtitle">Define role access for your organisation’s modules.</div>
        </div>
      </div>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Description</th>
              <th>System Role</th>
            </tr>
          </thead>
          <tbody>
            {companyRoles.map(role => (
              <tr key={role.id}>
                <td>{role.name}</td>
                <td>{role.description}</td>
                <td>{role.isSystem ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

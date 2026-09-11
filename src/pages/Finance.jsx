import React from 'react'
import { useStore } from '../store/useStore.js'
import { formatCurrency } from '../utils/currency.js'

export default function Finance() {
  const { financeInvoices, currency } = useStore()
  const totalPayments = financeInvoices.reduce((sum, inv) => sum + inv.amount, 0)
  const pending = financeInvoices.filter(inv => inv.status === 'pending').length
  const paid = financeInvoices.filter(inv => inv.status === 'paid').length

  return (
    <div className="page-card">
      <div className="page-header">
        <div>
          <div className="page-title">Finance</div>
          <div className="page-subtitle">Review invoices, expenses, and approvals for your organisation.</div>
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div className="card card-metric">
          <div className="metric-label">Total value</div>
          <div className="metric-value">{formatCurrency(totalPayments)}</div>
        </div>
        <div className="card card-metric">
          <div className="metric-label">Pending invoices</div>
          <div className="metric-value">{pending}</div>
        </div>
        <div className="card card-metric">
          <div className="metric-label">Paid invoices</div>
          <div className="metric-value">{paid}</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Vendor</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Due Date</th>
            </tr>
          </thead>
          <tbody>
            {financeInvoices.map(inv => (
              <tr key={inv.id}>
                <td>{inv.invoice_number}</td>
                <td>{inv.vendor}</td>
                <td>{formatCurrency(inv.amount)}</td>
                <td>{inv.status}</td>
                <td>{inv.due_date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

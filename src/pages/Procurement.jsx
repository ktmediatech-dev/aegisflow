import React from 'react'
import { useStore } from '../store/useStore.js'
import { formatCurrency } from '../utils/currency.js'

export default function Procurement() {
  const { procurementOrders } = useStore()
  const totalSpend = procurementOrders.reduce((sum, order) => sum + order.total_amount, 0)
  const suppliers = [...new Set(procurementOrders.map(o => o.supplier))].length
  const awaiting = procurementOrders.filter(order => order.status === 'ordered').length

  return (
    <div className="page-card">
      <div className="page-header">
        <div>
          <div className="page-title">Procurement</div>
          <div className="page-subtitle">Manage purchase orders, suppliers, and delivery timelines.</div>
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div className="card card-metric">
          <div className="metric-label">Total spend</div>
          <div className="metric-value">{formatCurrency(totalSpend)}</div>
        </div>
        <div className="card card-metric">
          <div className="metric-label">Suppliers</div>
          <div className="metric-value">{suppliers}</div>
        </div>
        <div className="card card-metric">
          <div className="metric-label">Awaiting delivery</div>
          <div className="metric-value">{awaiting}</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Supplier</th>
              <th>Total</th>
              <th>Status</th>
              <th>Expected Delivery</th>
            </tr>
          </thead>
          <tbody>
            {procurementOrders.map(order => (
              <tr key={order.id}>
                <td>{order.order_number}</td>
                <td>{order.supplier}</td>
                <td>{formatCurrency(order.total_amount)}</td>
                <td>{order.status}</td>
                <td>{order.expected_delivery}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

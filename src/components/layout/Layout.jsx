import React, { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import Header from './Header.jsx'
import { useStore } from '../../store/useStore.js'

export default function Layout() {
  const sidebarOpen = useStore(s => s.sidebarOpen)
  const fetchCompanyData = useStore(s => s.fetchCompanyData)

  // Login already loads company data; this covers a page refresh, where
  // the store rehydrates the token/user from localStorage but has no data yet.
  useEffect(() => {
    fetchCompanyData()
  }, [fetchCompanyData])

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        marginLeft: sidebarOpen ? 'var(--sidebar-width)' : '0',
        transition: 'margin-left 0.25s ease',
      }}>
        <Header />
        <main style={{
          flex: 1,
          overflow: 'auto',
          padding: '28px 32px',
          background: 'var(--bg-base)',
        }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

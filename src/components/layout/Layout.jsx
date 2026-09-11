import React, { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import Header from './Header.jsx'
import { useStore } from '../../store/useStore.js'
import { useTheme } from '../../context/ThemeContext.jsx'

export default function Layout() {
  const sidebarOpen = useStore(s => s.sidebarOpen)
  const fetchCompanyData = useStore(s => s.fetchCompanyData)
  const settings = useStore(s => s.settings)
  const { applyCompanyDefaultTheme } = useTheme()

  // Login already loads company data; this covers a page refresh, where
  // the store rehydrates the token/user from localStorage but has no data yet.
  useEffect(() => {
    fetchCompanyData()
  }, [fetchCompanyData])

  // Apply the company's default theme once settings load — only affects
  // browsers that haven't had a user explicitly pick their own theme.
  useEffect(() => {
    if (settings?.theme) applyCompanyDefaultTheme(settings.theme)
  }, [settings?.theme, applyCompanyDefaultTheme])

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

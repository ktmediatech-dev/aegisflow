import React from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore.js'
import {
  LayoutDashboard, Fuel, Truck, Database, Wrench,
  HardHat, Package, BarChart3, Bell, ShieldAlert,
  Upload, FileText, ChevronLeft, ChevronRight, Zap,
  Users, ShieldCheck, Briefcase, ClipboardList, Trash2, Settings, Lock
} from 'lucide-react'

const NAV = [
  { label: 'Overview', items: [
    { path: '/dashboard', module: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/alerts', module: 'dashboard', icon: Bell, label: 'Alerts', badge: 'alerts' },
    { path: '/analytics', module: 'analytics', icon: BarChart3, label: 'Analytics' },
  ]},
  { label: 'Operations', items: [
    { path: '/stations', module: 'stations', icon: Fuel, label: 'Stations' },
    { path: '/fleet', module: 'fleet', icon: Truck, label: 'Fleet' },
    { path: '/tanks', module: 'stations', icon: Database, label: 'Tanks & Inventory' },
    { path: '/maintenance', module: 'maintenance', icon: Wrench, label: 'Maintenance' },
  ]},
  { label: 'People & Admin', items: [
    { path: '/users', module: 'admin', icon: Users, label: 'Users' },
    { path: '/roles', module: 'admin', icon: ClipboardList, label: 'Roles' },
    { path: '/deletion-requests', module: 'admin', icon: Trash2, label: 'Deletion Requests' },
    { path: '/settings', module: 'admin', icon: Settings, label: 'Org Settings' },
    { path: '/hr', module: 'hr', icon: Briefcase, label: 'HR' },
  ]},
  { label: 'Platform', items: [
    { path: '/companies', module: 'platform_admin', icon: ShieldCheck, label: 'Companies' },
    { path: '/security', module: 'platform_admin', icon: Lock, label: 'Security (2FA)' },
  ]},
  { label: 'Finance & Supply', items: [
    { path: '/finance', module: 'finance', icon: FileText, label: 'Finance' },
    { path: '/procurement', module: 'procurement', icon: Package, label: 'Procurement' },
    { path: '/suppliers', module: 'suppliers', icon: Package, label: 'Suppliers' },
  ]},
  { label: 'Compliance', items: [
    { path: '/fraud', module: 'compliance', icon: ShieldCheck, label: 'Fraud Detection' },
    { path: '/compliance', module: 'compliance', icon: ShieldAlert, label: 'Compliance' },
    { path: '/contractors', module: 'maintenance', icon: HardHat, label: 'Contractors' },
  ]},
  { label: 'Data', items: [
    { path: '/import', module: 'admin', icon: Upload, label: 'Import Data' },
    { path: '/reports', module: 'reports', icon: FileText, label: 'Reports' },
  ]},
]

export default function Sidebar() {
  const { sidebarOpen, toggleSidebar, alerts, user, logout } = useStore()
  const navigate = useNavigate()
  const activeAlerts = alerts.filter(a => a.status === 'active').length

  const canRead = (moduleKey) => {
    if (!moduleKey) return false
    if (moduleKey === 'platform_admin') return user?.type === 'platform_admin'
    if (!user?.permissions) return false
    return user.permissions.some((perm) => perm.module === moduleKey && perm.can_read)
  }

  const filteredNav = NAV
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.module || canRead(item.module)),
    }))
    .filter((group) => group.items.length > 0)

  return (
    <aside style={{
      position: 'fixed',
      left: 0, top: 0, bottom: 0,
      width: 'var(--sidebar-width)',
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
      transition: 'transform 0.25s ease',
      zIndex: 50,
      overflowY: 'auto',
      overflowX: 'hidden',
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg, #3d8ef0, #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={18} color="white" fill="white" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>AegisFlow</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Petrol Intelligence</div>
          </div>
        </div>
        <button onClick={toggleSidebar} className="btn btn-ghost" style={{ padding: '4px', borderRadius: 6 }}>
          <ChevronLeft size={16} />
        </button>
      </div>

      {/* Nav groups */}
      <nav style={{ flex: 1, padding: '12px 10px' }}>
        {filteredNav.map(group => (
          <div key={group.label} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', padding: '0 10px', marginBottom: 6 }}>
              {group.label}
            </div>
            {group.items.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  textDecoration: 'none',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  background: isActive ? 'var(--bg-raised)' : 'transparent',
                  marginBottom: 2,
                  transition: 'all 0.15s ease',
                  position: 'relative',
                })}
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <div style={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: 3, background: 'var(--accent)', borderRadius: '0 2px 2px 0' }} />
                    )}
                    <item.icon size={16} color={isActive ? 'var(--accent)' : 'currentColor'} />
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.badge === 'alerts' && activeAlerts > 0 && (
                      <span style={{ background: 'var(--danger)', color: 'white', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999, minWidth: 18, textAlign: 'center' }}>
                        {activeAlerts}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-dim)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>{(user && user.name) ? user.name.split(' ').map(n=>n[0]).join('').slice(0,2) : 'AU'}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(user && user.name) || 'Admin User'}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{(user && (user.role || user.roleName)) || 'User'}</div>
          </div>
        </div>
        <div>
          <button
            onClick={() => { logout(); navigate('/login') }}
            className="btn btn-ghost"
            style={{ padding: '6px 8px', borderRadius: 8, fontSize: 13 }}
          >
            Logout
          </button>
        </div>
      </div>
    </aside>
  )
}

import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Layout from './components/layout/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Stations from './pages/Stations.jsx'
import Fleet from './pages/Fleet.jsx'
import Tanks from './pages/Tanks.jsx'
import Maintenance from './pages/Maintenance.jsx'
import Contractors from './pages/Contractors.jsx'
import Suppliers from './pages/Suppliers.jsx'
import Analytics from './pages/Analytics.jsx'
import Alerts from './pages/Alerts.jsx'
import FraudDetection from './pages/FraudDetection.jsx'
import DataImport from './pages/DataImport.jsx'
import Reports from './pages/Reports.jsx'
import Companies from './pages/Companies.jsx'
import Users from './pages/Users.jsx'
import Roles from './pages/Roles.jsx'
import DeletionRequests from './pages/DeletionRequests.jsx'
import OrgSettings from './pages/OrgSettings.jsx'
import HR from './pages/HR.jsx'
import Finance from './pages/Finance.jsx'
import Procurement from './pages/Procurement.jsx'
import Compliance from './pages/Compliance.jsx'
import Login from './pages/Login.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import { useStore } from './store/useStore.js'

// Platform admins land on Companies (they have no tenant dashboard to see);
// everyone else lands on Dashboard, same as before.
function IndexRedirect() {
  const user = useStore(s => s.user)
  return <Navigate to={user?.type === 'platform_admin' ? '/companies' : '/dashboard'} replace />
}

export default function App() {
  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1a2234',
            color: '#f0f4ff',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px',
            fontSize: '13px',
          }
        }}
      />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<IndexRedirect />} />
            <Route path="dashboard" element={<ProtectedRoute moduleKey="dashboard"><Dashboard /></ProtectedRoute>} />
          <Route path="stations" element={<ProtectedRoute moduleKey="stations"><Stations /></ProtectedRoute>} />
          <Route path="fleet" element={<ProtectedRoute moduleKey="fleet"><Fleet /></ProtectedRoute>} />
          <Route path="tanks" element={<ProtectedRoute moduleKey="stations"><Tanks /></ProtectedRoute>} />
          <Route path="maintenance" element={<ProtectedRoute moduleKey="maintenance"><Maintenance /></ProtectedRoute>} />
          <Route path="contractors" element={<ProtectedRoute moduleKey="maintenance"><Contractors /></ProtectedRoute>} />
          <Route path="suppliers" element={<ProtectedRoute moduleKey="suppliers"><Suppliers /></ProtectedRoute>} />
          <Route path="analytics" element={<ProtectedRoute moduleKey="analytics"><Analytics /></ProtectedRoute>} />
          <Route path="alerts" element={<ProtectedRoute moduleKey="dashboard"><Alerts /></ProtectedRoute>} />
          <Route path="companies" element={<ProtectedRoute platformOnly><Companies /></ProtectedRoute>} />
          <Route path="users" element={<ProtectedRoute moduleKey="admin"><Users /></ProtectedRoute>} />
          <Route path="roles" element={<ProtectedRoute moduleKey="admin"><Roles /></ProtectedRoute>} />
          <Route path="deletion-requests" element={<ProtectedRoute moduleKey="admin"><DeletionRequests /></ProtectedRoute>} />
          <Route path="settings" element={<ProtectedRoute moduleKey="admin"><OrgSettings /></ProtectedRoute>} />
          <Route path="hr" element={<ProtectedRoute moduleKey="hr"><HR /></ProtectedRoute>} />
          <Route path="finance" element={<ProtectedRoute moduleKey="finance"><Finance /></ProtectedRoute>} />
          <Route path="procurement" element={<ProtectedRoute moduleKey="procurement"><Procurement /></ProtectedRoute>} />
          <Route path="compliance" element={<ProtectedRoute moduleKey="compliance"><Compliance /></ProtectedRoute>} />
          <Route path="fraud" element={<ProtectedRoute moduleKey="compliance"><FraudDetection /></ProtectedRoute>} />
          <Route path="import" element={<ProtectedRoute moduleKey="admin"><DataImport /></ProtectedRoute>} />
          <Route path="reports" element={<ProtectedRoute moduleKey="reports"><Reports /></ProtectedRoute>} />
        </Route>
      </Routes>
    </>
  )
}

import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import useAuthStore from './context/authStore'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import TwoFactorSetup from './pages/TwoFactorSetup'
import Dashboard from './pages/Dashboard'
import StockDetail from './pages/StockDetail'
import Watchlist from './pages/Watchlist'
import Portfolio from './pages/Portfolio'
import Screener from './pages/Screener'
import Predictions from './pages/Predictions'
import Subscription from './pages/Subscription'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminUsers from './pages/admin/AdminUsers'
import AdminConfig from './pages/admin/AdminConfig'
import NotFound from './pages/NotFound'
import LoadingSpinner from './components/LoadingSpinner'

function ProtectedRoute({ children, adminOnly = false }) {
  const { isAuthenticated, isLoading, user } = useAuthStore()
  if (isLoading) return <LoadingSpinner />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (adminOnly && !['admin', 'superadmin'].includes(user?.role)) return <Navigate to="/dashboard" replace />
  return children
}

function PublicRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuthStore()
  if (isLoading) return <LoadingSpinner />
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  const init = useAuthStore(s => s.init)
  useEffect(() => { init() }, [init])

  return (
    <Routes>
      {/* Public auth pages */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
      <Route path="/reset-password/:token" element={<PublicRoute><ResetPassword /></PublicRoute>} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Protected app pages */}
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/stock/:symbol" element={<StockDetail />} />
        <Route path="/watchlist" element={<Watchlist />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/screener" element={<Screener />} />
        <Route path="/predictions" element={<Predictions />} />
        <Route path="/subscription" element={<Subscription />} />
        <Route path="/security/2fa" element={<TwoFactorSetup />} />
      </Route>

      {/* Admin routes */}
      <Route element={<ProtectedRoute adminOnly><Layout /></ProtectedRoute>}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/config" element={<AdminConfig />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

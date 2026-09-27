import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import useAuthStore from '../context/authStore'
import {
  FiHome, FiTrendingUp, FiBookmark, FiBriefcase, FiFilter,
  FiZap, FiCreditCard, FiUsers, FiSettings, FiLogOut, FiMenu, FiX, FiBell, FiShield, FiDatabase
} from 'react-icons/fi'
import SearchBar from './SearchBar'
import MarketTicker from './MarketTicker'

const navItems = [
  { to: '/dashboard', icon: FiHome, label: 'Dashboard' },
  { to: '/watchlist', icon: FiBookmark, label: 'Watchlist' },
  { to: '/portfolio', icon: FiBriefcase, label: 'Portfolio' },
  { to: '/screener', icon: FiFilter, label: 'Screener' },
  { to: '/predictions', icon: FiZap, label: 'AI Predictions' },
  { to: '/subscription', icon: FiCreditCard, label: 'Subscription' },
  { to: '/security/2fa', icon: FiShield, label: 'Security & 2FA' }
]

const adminItems = [
  { to: '/admin', icon: FiHome, label: 'Admin Home' },
  { to: '/admin/users', icon: FiUsers, label: 'Users' },
  { to: '/admin/config', icon: FiSettings, label: 'Market Config' },
  { to: '/admin/database', icon: FiDatabase, label: 'Database' }
]

export default function Layout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isAdmin = ['admin', 'superadmin'].includes(user?.role)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 border-r border-gray-800 flex flex-col transform transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <FiTrendingUp className="text-white" />
            </div>
            <span className="text-white font-bold text-lg">StockVision</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-400 hover:text-white">
            <FiX />
          </button>
        </div>

        {/* User info */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-gray-400 truncate capitalize">{user?.subscription?.plan} plan</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
              <Icon size={16} />
              {label}
            </NavLink>
          ))}

          {isAdmin && (
            <>
              <div className="pt-4 pb-1 px-3">
                <p className="text-xs text-gray-600 uppercase font-semibold tracking-wider">Admin</p>
              </div>
              {adminItems.map(({ to, icon: Icon, label }) => (
                <NavLink key={to} to={to} onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-purple-600/20 text-purple-400 border border-purple-600/30' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
                  <Icon size={16} />
                  {label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-gray-800">
          <button onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-red-400/10 w-full transition-colors">
            <FiLogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-16 bg-gray-900 border-b border-gray-800 flex items-center gap-4 px-4 flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-gray-400 hover:text-white">
            <FiMenu size={20} />
          </button>
          <div className="flex-1 max-w-xl">
            <SearchBar />
          </div>
          <button className="text-gray-400 hover:text-white relative">
            <FiBell size={20} />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
        </header>

        {/* Market ticker */}
        <MarketTicker />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

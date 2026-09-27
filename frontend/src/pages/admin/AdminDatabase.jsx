import { useEffect, useState, useCallback } from 'react'
import { adminAPI } from '../../services/api'
import toast from 'react-hot-toast'
import {
  FiDatabase, FiRefreshCw, FiUsers, FiActivity, FiAlertTriangle,
  FiUnlock, FiKey, FiCheckCircle, FiXCircle, FiClock, FiServer
} from 'react-icons/fi'
import clsx from 'clsx'

// ── helpers ───────────────────────────────────────────────────────────────────
function StatusDot({ state }) {
  const colors = { connected: 'bg-green-400', disconnected: 'bg-red-400', connecting: 'bg-yellow-400', disconnecting: 'bg-orange-400' }
  return (
    <span className={clsx('inline-block w-2.5 h-2.5 rounded-full mr-2', colors[state] || 'bg-gray-500')} />
  )
}

function StatCard({ icon: Icon, label, value, color = 'text-blue-400', bg = 'bg-blue-400/10' }) {
  return (
    <div className="card">
      <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center mb-3', bg)}>
        <Icon size={18} className={color} />
      </div>
      <p className="text-2xl font-bold text-white">{typeof value === 'number' ? value.toLocaleString() : (value ?? '–')}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  )
}

const TABS = ['Overview', 'Recent Users', 'Login Activity', 'AI Predictions', 'Locked Accounts']

export default function AdminDatabase() {
  const [status, setStatus] = useState(null)
  const [activity, setActivity] = useState(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [activityLoading, setActivityLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('Overview')

  // Password reset modal
  const [showReset, setShowReset] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetPass, setResetPass] = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  // Unlock modal
  const [showUnlock, setShowUnlock] = useState(false)
  const [unlockEmail, setUnlockEmail] = useState('')
  const [unlockLoading, setUnlockLoading] = useState(false)

  const loadStatus = useCallback(() => {
    setStatusLoading(true)
    adminAPI.getDbStatus()
      .then(r => setStatus(r.data))
      .catch(() => toast.error('Failed to load DB status'))
      .finally(() => setStatusLoading(false))
  }, [])

  const loadActivity = useCallback(() => {
    setActivityLoading(true)
    adminAPI.getDbActivity()
      .then(r => setActivity(r.data))
      .catch(() => toast.error('Failed to load activity'))
      .finally(() => setActivityLoading(false))
  }, [])

  useEffect(() => { loadStatus(); loadActivity() }, [loadStatus, loadActivity])

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setResetLoading(true)
    try {
      const res = await adminAPI.dbResetPassword({ email: resetEmail, newPassword: resetPass })
      toast.success(res.data.message)
      setShowReset(false)
      setResetEmail('')
      setResetPass('')
      loadActivity()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Reset failed')
    } finally { setResetLoading(false) }
  }

  const handleUnlock = async (e) => {
    e.preventDefault()
    setUnlockLoading(true)
    try {
      const res = await adminAPI.dbUnlockAccount({ email: unlockEmail })
      toast.success(res.data.message)
      setShowUnlock(false)
      setUnlockEmail('')
      loadActivity()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Unlock failed')
    } finally { setUnlockLoading(false) }
  }

  const conn = status?.connection
  const cols = status?.collections
  const dbst = status?.dbStats

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FiDatabase className="text-purple-400" /> Database Manager
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">MongoDB connection status, collection stats & user activity</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowUnlock(true)}
            className="btn-secondary flex items-center gap-1.5 text-sm h-9 px-3">
            <FiUnlock size={14} /> Unlock Account
          </button>
          <button onClick={() => setShowReset(true)}
            className="btn-secondary flex items-center gap-1.5 text-sm h-9 px-3 text-yellow-400 border-yellow-600/30 hover:border-yellow-600/60">
            <FiKey size={14} /> Reset Password
          </button>
          <button onClick={() => { loadStatus(); loadActivity() }}
            className="btn-secondary flex items-center gap-1.5 text-sm h-9 px-3">
            <FiRefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Connection banner */}
      {statusLoading ? (
        <div className="card flex items-center gap-3 animate-pulse">
          <div className="w-3 h-3 bg-gray-700 rounded-full" />
          <span className="text-gray-500 text-sm">Checking connection…</span>
        </div>
      ) : conn && (
        <div className={clsx('card flex items-center justify-between flex-wrap gap-4',
          conn.state === 'connected' ? 'border-green-600/30' : 'border-red-600/30')}>
          <div className="flex items-center gap-3">
            <StatusDot state={conn.state} />
            <div>
              <p className="text-white font-semibold capitalize">{conn.state}</p>
              <p className="text-xs text-gray-400">
                {conn.inMemory
                  ? '⚡ In-memory MongoDB (data lost on restart)'
                  : `${conn.host}:${conn.port} / ${conn.name}`}
              </p>
            </div>
          </div>
          {dbst && (
            <div className="flex gap-6 text-sm">
              <div className="text-center">
                <p className="text-white font-bold">{dbst.dataSize.toLocaleString()} KB</p>
                <p className="text-gray-500 text-xs">Data size</p>
              </div>
              <div className="text-center">
                <p className="text-white font-bold">{dbst.storageSize.toLocaleString()} KB</p>
                <p className="text-gray-500 text-xs">Storage</p>
              </div>
              <div className="text-center">
                <p className="text-white font-bold">{dbst.indexes}</p>
                <p className="text-gray-500 text-xs">Indexes</p>
              </div>
            </div>
          )}
          {conn.inMemory && (
            <span className="text-xs bg-yellow-400/10 text-yellow-400 border border-yellow-600/30 px-2 py-1 rounded-full">
              ⚠ Install MongoDB for persistent storage
            </span>
          )}
        </div>
      )}

      {/* Collection stat cards */}
      {cols && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard icon={FiUsers}    label="Users"          value={cols.users}         color="text-blue-400"   bg="bg-blue-400/10" />
          <StatCard icon={FiServer}   label="Refresh Tokens" value={cols.refreshTokens}  color="text-gray-400"   bg="bg-gray-400/10" />
          <StatCard icon={FiActivity} label="Predictions"    value={cols.predictions}    color="text-purple-400" bg="bg-purple-400/10" />
          <StatCard icon={FiDatabase} label="Watchlists"     value={cols.watchlists}     color="text-green-400"  bg="bg-green-400/10" />
          <StatCard icon={FiDatabase} label="Portfolios"     value={cols.portfolios}     color="text-yellow-400" bg="bg-yellow-400/10" />
          <StatCard icon={FiDatabase} label="Market Configs" value={cols.marketConfigs}  color="text-orange-400" bg="bg-orange-400/10" />
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-800">
        <nav className="flex gap-1 overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={clsx('px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                activeTab === tab
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-gray-500 hover:text-gray-300')}>
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activityLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 border-4 border-gray-700 border-t-purple-500 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Overview */}
          {activeTab === 'Overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card">
                <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                  <FiUsers size={15} className="text-blue-400" /> Latest Registrations
                </h3>
                <div className="space-y-2">
                  {(activity?.recentUsers || []).slice(0, 8).map(u => (
                    <div key={u._id} className="flex items-center justify-between text-sm">
                      <div>
                        <span className="text-white">{u.name}</span>
                        <span className="text-gray-500 ml-2 text-xs">{u.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600">{new Date(u.createdAt).toLocaleDateString('en-IN')}</span>
                        <span className={clsx('text-xs px-1.5 py-0.5 rounded capitalize',
                          { free: 'bg-gray-800 text-gray-400', basic: 'bg-blue-400/10 text-blue-400', pro: 'bg-purple-400/10 text-purple-400', enterprise: 'bg-green-400/10 text-green-400' }[u.subscription?.plan])}>
                          {u.subscription?.plan}
                        </span>
                      </div>
                    </div>
                  ))}
                  {!activity?.recentUsers?.length && <p className="text-gray-500 text-sm">No users found</p>}
                </div>
              </div>

              <div className="card">
                <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                  <FiAlertTriangle size={15} className="text-red-400" /> Locked Accounts
                </h3>
                {(activity?.lockedAccounts || []).length === 0 ? (
                  <div className="flex items-center gap-2 text-green-400 text-sm">
                    <FiCheckCircle size={15} /> No locked accounts — all clear
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activity.lockedAccounts.map(u => (
                      <div key={u._id} className="flex items-center justify-between text-sm bg-red-400/5 border border-red-600/20 rounded-lg px-3 py-2">
                        <div>
                          <p className="text-white">{u.name}</p>
                          <p className="text-gray-400 text-xs">{u.email}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-red-400 text-xs">{u.loginAttempts} failed attempts</p>
                          <p className="text-gray-500 text-xs">Locked until {new Date(u.lockUntil).toLocaleTimeString('en-IN')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recent Users */}
          {activeTab === 'Recent Users' && (
            <div className="card p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-800">
                    {['Name', 'Email', 'Role', 'Plan', 'Joined'].map(h => (
                      <th key={h} className="text-left text-xs text-gray-500 font-medium px-4 py-3">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {(activity?.recentUsers || []).map(u => (
                      <tr key={u._id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                        <td className="px-4 py-3 font-medium text-white">{u.name}</td>
                        <td className="px-4 py-3 text-gray-400">{u.email}</td>
                        <td className="px-4 py-3 text-gray-300 capitalize">{u.role}</td>
                        <td className="px-4 py-3"><span className="text-xs capitalize text-gray-400">{u.subscription?.plan}</span></td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{new Date(u.createdAt).toLocaleDateString('en-IN')}</td>
                      </tr>
                    ))}
                    {!activity?.recentUsers?.length && (
                      <tr><td colSpan={5} className="text-center py-8 text-gray-500">No users yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Login Activity */}
          {activeTab === 'Login Activity' && (
            <div className="card p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-800">
                    {['Name', 'Email', 'Last Login', 'IP Address'].map(h => (
                      <th key={h} className="text-left text-xs text-gray-500 font-medium px-4 py-3">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {(activity?.recentLogins || []).map(u => (
                      <tr key={u._id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                        <td className="px-4 py-3 font-medium text-white">{u.name}</td>
                        <td className="px-4 py-3 text-gray-400">{u.email}</td>
                        <td className="px-4 py-3 text-gray-300 text-xs flex items-center gap-1">
                          <FiClock size={11} className="text-gray-500" />
                          {u.lastLogin ? new Date(u.lastLogin).toLocaleString('en-IN') : '–'}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs font-mono">{u.lastLoginIP || '–'}</td>
                      </tr>
                    ))}
                    {!activity?.recentLogins?.length && (
                      <tr><td colSpan={4} className="text-center py-8 text-gray-500">No login data yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* AI Predictions */}
          {activeTab === 'AI Predictions' && (
            <div className="card p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-800">
                    {['Symbol', 'Requested By', 'Signal', 'Date'].map(h => (
                      <th key={h} className="text-left text-xs text-gray-500 font-medium px-4 py-3">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {(activity?.recentPredictions || []).map(p => (
                      <tr key={p._id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                        <td className="px-4 py-3 font-bold text-white">{p.symbol}</td>
                        <td className="px-4 py-3 text-gray-400">{p.requestedBy?.email || '–'}</td>
                        <td className="px-4 py-3">
                          {p.result?.prediction ? (
                            <span className={clsx('text-xs font-semibold uppercase',
                              p.result.prediction === 'buy' ? 'text-green-400' : p.result.prediction === 'sell' ? 'text-red-400' : 'text-yellow-400')}>
                              {p.result.prediction}
                            </span>
                          ) : <span className="text-gray-600 text-xs">–</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{new Date(p.createdAt).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                    {!activity?.recentPredictions?.length && (
                      <tr><td colSpan={4} className="text-center py-8 text-gray-500">No predictions yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Locked Accounts */}
          {activeTab === 'Locked Accounts' && (
            <div className="space-y-3">
              {(activity?.lockedAccounts || []).length === 0 ? (
                <div className="card flex items-center gap-3 text-green-400">
                  <FiCheckCircle size={18} />
                  <span>No locked accounts right now.</span>
                </div>
              ) : activity.lockedAccounts.map(u => (
                <div key={u._id} className="card flex items-center justify-between gap-4">
                  <div>
                    <p className="text-white font-medium">{u.name}</p>
                    <p className="text-gray-400 text-sm">{u.email}</p>
                    <p className="text-xs text-red-400 mt-1">{u.loginAttempts} failed login attempts · locked until {new Date(u.lockUntil).toLocaleString('en-IN')}</p>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const r = await adminAPI.dbUnlockAccount({ email: u.email })
                        toast.success(r.data.message)
                        loadActivity()
                      } catch (err) { toast.error(err.response?.data?.error || 'Failed') }
                    }}
                    className="btn-secondary text-sm h-8 px-3 flex items-center gap-1.5 text-green-400 border-green-600/30 hover:border-green-600/60">
                    <FiUnlock size={13} /> Unlock
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Reset Password Modal ── */}
      {showReset && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowReset(false)}>
          <div className="card w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-white mb-1 flex items-center gap-2"><FiKey size={15} className="text-yellow-400" /> Reset User Password</h3>
            <p className="text-xs text-gray-500 mb-4">All active sessions for the user will be revoked.</p>
            <form onSubmit={handleResetPassword} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">User Email</label>
                <input type="email" required value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                  placeholder="user@example.com" className="input text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">New Password (min 8 chars)</label>
                <input type="password" required minLength={8} value={resetPass} onChange={e => setResetPass(e.target.value)}
                  placeholder="••••••••" className="input text-sm" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowReset(false)} className="btn-secondary flex-1 text-sm">Cancel</button>
                <button type="submit" disabled={resetLoading} className="btn-primary flex-1 text-sm bg-yellow-600 hover:bg-yellow-700 border-yellow-600">
                  {resetLoading ? 'Resetting…' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Unlock Account Modal ── */}
      {showUnlock && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowUnlock(false)}>
          <div className="card w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-white mb-1 flex items-center gap-2"><FiUnlock size={15} className="text-green-400" /> Unlock Account</h3>
            <p className="text-xs text-gray-500 mb-4">Clears failed login attempts and removes the lock.</p>
            <form onSubmit={handleUnlock} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">User Email</label>
                <input type="email" required value={unlockEmail} onChange={e => setUnlockEmail(e.target.value)}
                  placeholder="user@example.com" className="input text-sm" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowUnlock(false)} className="btn-secondary flex-1 text-sm">Cancel</button>
                <button type="submit" disabled={unlockLoading} className="btn-primary flex-1 text-sm">
                  {unlockLoading ? 'Unlocking…' : 'Unlock Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

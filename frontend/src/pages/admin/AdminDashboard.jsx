import { useEffect, useState } from 'react'
import { adminAPI } from '../../services/api'
import { FiUsers, FiActivity, FiTrendingUp, FiZap, FiBarChart2, FiRefreshCw } from 'react-icons/fi'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const COLORS = ['#6b7280', '#3b82f6', '#8b5cf6', '#10b981']

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminAPI.getStats()
      .then(res => setStats(res.data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center h-64 items-center"><div className="h-8 w-8 border-4 border-gray-700 border-t-purple-500 rounded-full animate-spin" /></div>

  const planData = stats ? [
    { name: 'Free', value: stats.subscriptions.free },
    { name: 'Basic', value: stats.subscriptions.basic },
    { name: 'Pro', value: stats.subscriptions.pro },
    { name: 'Enterprise', value: stats.subscriptions.enterprise }
  ] : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-gray-400 text-sm mt-0.5">Platform overview and management</p>
        </div>
        <button onClick={() => adminAPI.getStats().then(res => setStats(res.data))} className="btn-secondary flex items-center gap-1 text-sm h-9 px-3">
          <FiRefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: stats?.users?.total || 0, icon: FiUsers, color: 'text-blue-400', bg: 'bg-blue-400/10' },
          { label: 'Active Users', value: stats?.users?.active || 0, icon: FiActivity, color: 'text-green-400', bg: 'bg-green-400/10' },
          { label: 'Today Logins', value: stats?.activity?.todayLogins || 0, icon: FiTrendingUp, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
          { label: 'AI Predictions', value: stats?.activity?.totalPredictions || 0, icon: FiZap, color: 'text-purple-400', bg: 'bg-purple-400/10' }
        ].map(c => (
          <div key={c.label} className="card">
            <div className={`w-10 h-10 ${c.bg} rounded-xl flex items-center justify-center mb-3`}>
              <c.icon size={18} className={c.color} />
            </div>
            <p className="text-2xl font-bold text-white">{c.value.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subscription breakdown */}
        <div className="card">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2"><FiBarChart2 size={16} className="text-purple-400" /> Subscription Distribution</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={planData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                label={({ name, value }) => `${name}: ${value}`} labelLine={true} fontSize={11}>
                {planData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue estimate */}
        <div className="card">
          <h2 className="font-semibold text-white mb-4">Revenue Estimate (MRR)</h2>
          <div className="space-y-3">
            {[
              { plan: 'Free', count: stats?.subscriptions?.free, price: 0, color: 'bg-gray-600' },
              { plan: 'Basic', count: stats?.subscriptions?.basic, price: 299, color: 'bg-blue-600' },
              { plan: 'Pro', count: stats?.subscriptions?.pro, price: 999, color: 'bg-purple-600' },
              { plan: 'Enterprise', count: stats?.subscriptions?.enterprise, price: 4999, color: 'bg-green-600' }
            ].map(r => {
              const rev = (r.count || 0) * r.price
              const maxRev = (stats?.subscriptions?.enterprise || 1) * 4999 || 1
              return (
                <div key={r.plan}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">{r.plan} ({r.count || 0} users)</span>
                    <span className="text-white font-medium">₹{rev.toLocaleString()}/mo</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full">
                    <div className={`h-2 ${r.color} rounded-full`} style={{ width: `${Math.min(100, (rev / Math.max(1, ((stats?.subscriptions?.enterprise || 0) * 4999))) * 100)}%` }} />
                  </div>
                </div>
              )
            })}
            <div className="pt-3 border-t border-gray-800 flex justify-between">
              <span className="text-gray-400 font-medium">Total MRR</span>
              <span className="text-white font-bold text-lg">
                ₹{(((stats?.subscriptions?.basic || 0) * 299) + ((stats?.subscriptions?.pro || 0) * 999) + ((stats?.subscriptions?.enterprise || 0) * 4999)).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Manage Users', desc: 'View, edit, and manage user accounts', to: '/admin/users', color: 'border-blue-600/30 hover:border-blue-600/60' },
          { label: 'Market Config', desc: 'Configure NSE, BSE, and global exchange feeds', to: '/admin/config', color: 'border-purple-600/30 hover:border-purple-600/60' },
          { label: 'Stock Screener', desc: 'Advanced screening with full admin access', to: '/screener', color: 'border-green-600/30 hover:border-green-600/60' }
        ].map(link => (
          <a key={link.label} href={link.to}
            className={`card transition-all cursor-pointer ${link.color}`}>
            <h3 className="font-semibold text-white">{link.label}</h3>
            <p className="text-xs text-gray-500 mt-1">{link.desc}</p>
          </a>
        ))}
      </div>
    </div>
  )
}

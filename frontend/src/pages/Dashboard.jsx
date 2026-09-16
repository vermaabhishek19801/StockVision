import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { marketAPI, stockAPI } from '../services/api'
import { getSocket } from '../services/socket'
import useAuthStore from '../context/authStore'
import { FiTrendingUp, FiTrendingDown, FiArrowUp, FiArrowDown, FiRefreshCw } from 'react-icons/fi'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import clsx from 'clsx'

function StatCard({ label, value, change, changePercent, up }) {
  return (
    <div className="card flex-1 min-w-0">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-white truncate">{value}</p>
      {change !== undefined && (
        <div className={clsx('flex items-center gap-1 mt-1 text-xs font-medium', up ? 'text-green-400' : 'text-red-400')}>
          {up ? <FiArrowUp size={11} /> : <FiArrowDown size={11} />}
          {Math.abs(changePercent || 0).toFixed(2)}%
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuthStore()
  const [indices, setIndices] = useState([])
  const [gainers, setGainers] = useState([])
  const [losers, setLosers] = useState([])
  const [loading, setLoading] = useState(true)
  const [niftyHistory, setNiftyHistory] = useState([])

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)
      try {
        const [idxRes, gainRes, losRes, histRes] = await Promise.allSettled([
          marketAPI.getIndices(),
          marketAPI.getGainers(),
          marketAPI.getLosers(),
          stockAPI.getHistory('^NSEI', { period1: new Date(Date.now() - 90 * 864e5).toISOString().split('T')[0], period2: new Date().toISOString().split('T')[0] })
        ])
        if (idxRes.status === 'fulfilled') setIndices(idxRes.value.data.indices || [])
        if (gainRes.status === 'fulfilled') setGainers(gainRes.value.data.stocks?.slice(0, 8) || [])
        if (losRes.status === 'fulfilled') setLosers(losRes.value.data.stocks?.slice(0, 8) || [])
        if (histRes.status === 'fulfilled') setNiftyHistory(histRes.value.data.history?.slice(-30) || [])
      } finally {
        setLoading(false)
      }
    }
    fetchAll()

    // Subscribe to indices via socket
    const socket = getSocket()
    socket.on('indices', ({ indices: idx }) => setIndices(idx))
    return () => socket.off('indices')
  }, [])

  const nifty = indices.find(i => i.symbol === '^NSEI')
  const sensex = indices.find(i => i.symbol === '^BSESN')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Good {getGreeting()}, {user?.name?.split(' ')[0]}!</h1>
          <p className="text-gray-400 text-sm mt-0.5">Here's today's market overview</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-green-400">
          <span className="w-2 h-2 rounded-full bg-green-400 live-dot" />
          Live Data
        </div>
      </div>

      {/* Key indices */}
      <div className="flex gap-4 overflow-x-auto pb-1">
        {indices.slice(0, 6).map(idx => (
          <StatCard key={idx.symbol}
            label={idx.name || idx.symbol}
            value={idx.price?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            change={idx.change} changePercent={idx.changePercent}
            up={(idx.changePercent || 0) >= 0}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Nifty 50 chart */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-white">NIFTY 50</h2>
              {nifty && (
                <p className="text-sm text-gray-400">
                  {nifty.price?.toLocaleString('en-IN')}
                  <span className={clsx('ml-2', (nifty.changePercent || 0) >= 0 ? 'text-green-400' : 'text-red-400')}>
                    {(nifty.changePercent || 0) >= 0 ? '▲' : '▼'} {Math.abs(nifty.changePercent || 0).toFixed(2)}%
                  </span>
                </p>
              )}
            </div>
          </div>
          {niftyHistory.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={niftyHistory}>
                <defs>
                  <linearGradient id="niftyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={d => new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} />
                <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} domain={['auto', 'auto']} tickFormatter={v => (v / 1000).toFixed(0) + 'k'} />
                <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                  formatter={v => [v?.toLocaleString('en-IN', { maximumFractionDigits: 2 }), 'Close']}
                  labelFormatter={d => new Date(d).toLocaleDateString('en-IN')} />
                <Area type="monotone" dataKey="close" stroke="#3b82f6" fill="url(#niftyGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-600">Loading chart...</div>
          )}
        </div>

        {/* Quick stats */}
        <div className="card">
          <h2 className="font-semibold text-white mb-4">Market Snapshot</h2>
          <div className="space-y-3">
            {[nifty, sensex, indices.find(i => i.symbol === '^GSPC'), indices.find(i => i.symbol === '^DJI')].filter(Boolean).map(idx => (
              <div key={idx.symbol} className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white font-medium">{idx.name || idx.symbol}</p>
                  <p className="text-xs text-gray-500">{idx.exchange}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-white">{idx.price?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                  <p className={clsx('text-xs font-medium', (idx.changePercent || 0) >= 0 ? 'text-green-400' : 'text-red-400')}>
                    {(idx.changePercent || 0) >= 0 ? '+' : ''}{(idx.changePercent || 0).toFixed(2)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Gainers & Losers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <FiTrendingUp className="text-green-400" /> Top Gainers
          </h2>
          <div className="space-y-2">
            {gainers.map(s => (
              <Link key={s.symbol} to={`/stock/${s.symbol}`}
                className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0 hover:bg-gray-800/50 -mx-4 px-4 transition-colors">
                <div>
                  <p className="text-sm font-semibold text-white">{s.symbol}</p>
                  <p className="text-xs text-gray-500 truncate max-w-32">{s.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-white">₹{s.price?.toFixed(2)}</p>
                  <span className="badge-up">+{(s.changePercent || 0).toFixed(2)}%</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <FiTrendingDown className="text-red-400" /> Top Losers
          </h2>
          <div className="space-y-2">
            {losers.map(s => (
              <Link key={s.symbol} to={`/stock/${s.symbol}`}
                className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0 hover:bg-gray-800/50 -mx-4 px-4 transition-colors">
                <div>
                  <p className="text-sm font-semibold text-white">{s.symbol}</p>
                  <p className="text-xs text-gray-500 truncate max-w-32">{s.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-white">₹{s.price?.toFixed(2)}</p>
                  <span className="badge-down">{(s.changePercent || 0).toFixed(2)}%</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

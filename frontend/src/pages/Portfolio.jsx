import { useEffect, useState } from 'react'
import { portfolioAPI, stockAPI } from '../services/api'
import toast from 'react-hot-toast'
import { FiPlus, FiTrendingUp, FiTrendingDown, FiDollarSign } from 'react-icons/fi'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import clsx from 'clsx'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899']

export default function Portfolio() {
  const [portfolios, setPortfolios] = useState([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [liveQuotes, setLiveQuotes] = useState({})
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [txForm, setTxForm] = useState({ symbol: '', type: 'buy', quantity: '', price: '' })
  const [adding, setAdding] = useState(false)

  const fetchLiveQuotes = async (holdings) => {
    const results = await Promise.allSettled(holdings.map(h => stockAPI.getQuote(h.symbol)))
    const q = {}
    results.forEach((r, i) => { if (r.status === 'fulfilled') q[holdings[i].symbol] = r.value.data.quote })
    setLiveQuotes(q)
  }

  useEffect(() => {
    portfolioAPI.getAll()
      .then(res => {
        const p = res.data.portfolios || []
        setPortfolios(p)
        if (p[0]?.holdings?.length) fetchLiveQuotes(p[0].holdings)
      })
      .finally(() => setLoading(false))
  }, [])

  const active = portfolios[activeIdx]
  const holdings = active?.holdings || []

  const holdings_enriched = holdings.map(h => {
    const q = liveQuotes[h.symbol]
    const currentPrice = q?.price || h.avgBuyPrice
    const currentValue = currentPrice * h.quantity
    const pnl = (currentPrice - h.avgBuyPrice) * h.quantity
    const pnlPct = ((currentPrice - h.avgBuyPrice) / h.avgBuyPrice) * 100
    return { ...h, currentPrice, currentValue, pnl, pnlPct }
  })

  const totalInvested = holdings_enriched.reduce((s, h) => s + h.totalInvested, 0)
  const totalCurrent = holdings_enriched.reduce((s, h) => s + h.currentValue, 0)
  const totalPnL = totalCurrent - totalInvested
  const totalPnLPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0

  const handleAddTransaction = async () => {
    if (!active) { toast.error('Create a portfolio first'); return }
    if (!txForm.symbol || !txForm.quantity || !txForm.price) { toast.error('Fill all fields'); return }
    setAdding(true)
    try {
      const res = await portfolioAPI.addTransaction(active._id, {
        symbol: txForm.symbol.toUpperCase(), type: txForm.type,
        quantity: parseFloat(txForm.quantity), price: parseFloat(txForm.price)
      })
      const updated = portfolios.map((p, i) => i === activeIdx ? res.data.portfolio : p)
      setPortfolios(updated)
      fetchLiveQuotes(res.data.portfolio.holdings)
      setTxForm({ symbol: '', type: 'buy', quantity: '', price: '' })
      setShowAdd(false)
      toast.success(`${txForm.type === 'buy' ? 'Bought' : 'Sold'} ${txForm.quantity} shares of ${txForm.symbol}`)
    } catch (err) { toast.error(err.response?.data?.error || 'Transaction failed') }
    finally { setAdding(false) }
  }

  const createPortfolio = async () => {
    try {
      const res = await portfolioAPI.create({ name: 'My Portfolio ' + (portfolios.length + 1) })
      setPortfolios(p => [...p, res.data.portfolio])
      setActiveIdx(portfolios.length)
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to create portfolio') }
  }

  if (loading) return <div className="flex justify-center h-64 items-center"><div className="h-8 w-8 border-4 border-gray-700 border-t-blue-500 rounded-full animate-spin" /></div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Portfolio</h1>
        <div className="flex gap-2">
          <button onClick={createPortfolio} className="btn-secondary flex items-center gap-1 text-sm h-9 px-3">
            <FiPlus size={15} /> New Portfolio
          </button>
          <button onClick={() => setShowAdd(p => !p)} className="btn-primary flex items-center gap-1 text-sm h-9 px-3">
            <FiPlus size={15} /> Add Trade
          </button>
        </div>
      </div>

      {portfolios.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {portfolios.map((p, i) => (
            <button key={p._id} onClick={() => { setActiveIdx(i); fetchLiveQuotes(p.holdings) }}
              className={clsx('px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors', i === activeIdx ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white')}>
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Invested', value: `₹${totalInvested.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, icon: FiDollarSign, color: 'text-blue-400' },
          { label: 'Current Value', value: `₹${totalCurrent.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, icon: FiTrendingUp, color: 'text-green-400' },
          { label: 'Total P&L', value: `₹${totalPnL.toFixed(2)}`, icon: totalPnL >= 0 ? FiTrendingUp : FiTrendingDown, color: totalPnL >= 0 ? 'text-green-400' : 'text-red-400' },
          { label: 'Returns', value: `${totalPnLPct.toFixed(2)}%`, icon: FiTrendingUp, color: totalPnLPct >= 0 ? 'text-green-400' : 'text-red-400' }
        ].map(c => (
          <div key={c.label} className="card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">{c.label}</span>
              <c.icon size={15} className={c.color} />
            </div>
            <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Add transaction form */}
      {showAdd && (
        <div className="card border-blue-600/30">
          <h3 className="font-semibold text-white mb-3">Add Transaction</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <input value={txForm.symbol} onChange={e => setTxForm(p => ({ ...p, symbol: e.target.value.toUpperCase() }))}
              placeholder="Symbol (e.g. RELIANCE)" className="input text-sm" />
            <select value={txForm.type} onChange={e => setTxForm(p => ({ ...p, type: e.target.value }))}
              className="input text-sm">
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>
            <input type="number" value={txForm.quantity} onChange={e => setTxForm(p => ({ ...p, quantity: e.target.value }))}
              placeholder="Quantity" className="input text-sm" />
            <input type="number" value={txForm.price} onChange={e => setTxForm(p => ({ ...p, price: e.target.value }))}
              placeholder="Price" className="input text-sm" />
            <button onClick={handleAddTransaction} disabled={adding} className="btn-primary text-sm">
              {adding ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {/* Holdings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 card p-0">
          <div className="p-4 border-b border-gray-800">
            <h2 className="font-semibold text-white">Holdings {active && `— ${active.name}`}</h2>
          </div>
          {holdings_enriched.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              <FiTrendingUp size={32} className="mx-auto mb-2 opacity-20" />
              <p>No holdings. Add your first trade above.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-800">
                  {['Symbol', 'Qty', 'Avg Price', 'CMP', 'Invested', 'Value', 'P&L', '% Change'].map(h => (
                    <th key={h} className="text-left text-xs text-gray-500 font-medium px-4 py-2">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {holdings_enriched.map(h => (
                    <tr key={h.symbol} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3 font-semibold text-white">{h.symbol}</td>
                      <td className="px-4 py-3 text-gray-300">{h.quantity}</td>
                      <td className="px-4 py-3 text-gray-300">{h.avgBuyPrice?.toFixed(2)}</td>
                      <td className="px-4 py-3 text-white">{h.currentPrice?.toFixed(2)}</td>
                      <td className="px-4 py-3 text-gray-300">₹{h.totalInvested?.toFixed(0)}</td>
                      <td className="px-4 py-3 text-white">₹{h.currentValue?.toFixed(0)}</td>
                      <td className={clsx('px-4 py-3 font-medium', h.pnl >= 0 ? 'text-green-400' : 'text-red-400')}>₹{h.pnl?.toFixed(2)}</td>
                      <td className={clsx('px-4 py-3 font-medium', h.pnlPct >= 0 ? 'text-green-400' : 'text-red-400')}>{h.pnlPct?.toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {holdings_enriched.length > 0 && (
          <div className="card">
            <h2 className="font-semibold text-white mb-4">Allocation</h2>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={holdings_enriched} dataKey="currentValue" nameKey="symbol" cx="50%" cy="50%" outerRadius={80} label={({ symbol, percent }) => `${symbol} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                  {holdings_enriched.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v => [`₹${v?.toFixed(2)}`, 'Value']} contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}

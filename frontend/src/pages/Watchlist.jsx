import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { watchlistAPI, stockAPI } from '../services/api'
import toast from 'react-hot-toast'
import { FiPlus, FiTrash2, FiRefreshCw, FiTrendingUp, FiTrendingDown } from 'react-icons/fi'
import clsx from 'clsx'

export default function Watchlist() {
  const [watchlists, setWatchlists] = useState([])
  const [activeList, setActiveList] = useState(null)
  const [quotes, setQuotes] = useState({})
  const [loading, setLoading] = useState(true)
  const [newListName, setNewListName] = useState('')
  const [creating, setCreating] = useState(false)

  const fetchQuotes = async (symbols) => {
    const results = await Promise.allSettled(symbols.map(s => stockAPI.getQuote(s.symbol)))
    const q = {}
    results.forEach((r, i) => { if (r.status === 'fulfilled') q[symbols[i].symbol] = r.value.data.quote })
    setQuotes(prev => ({ ...prev, ...q }))
  }

  useEffect(() => {
    watchlistAPI.getAll()
      .then(res => {
        const lists = res.data.watchlists || []
        setWatchlists(lists)
        if (lists.length) { setActiveList(lists[0]); fetchQuotes(lists[0].symbols) }
      })
      .finally(() => setLoading(false))
  }, [])

  const handleCreate = async () => {
    if (!newListName.trim()) return
    setCreating(true)
    try {
      const res = await watchlistAPI.create(newListName.trim())
      setWatchlists(p => [...p, res.data.watchlist])
      setNewListName('')
      toast.success('Watchlist created')
    } catch (err) { toast.error(err.response?.data?.error || 'Failed') }
    finally { setCreating(false) }
  }

  const handleRemoveSymbol = async (listId, symbol) => {
    try {
      const res = await watchlistAPI.removeSymbol(listId, symbol)
      setWatchlists(p => p.map(l => l._id === listId ? res.data.watchlist : l))
      if (activeList?._id === listId) setActiveList(res.data.watchlist)
      toast.success(`${symbol} removed`)
    } catch { toast.error('Failed to remove') }
  }

  if (loading) return <div className="flex justify-center h-64 items-center"><div className="h-8 w-8 border-4 border-gray-700 border-t-blue-500 rounded-full animate-spin" /></div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Watchlists</h1>
        <div className="flex gap-2">
          <input value={newListName} onChange={e => setNewListName(e.target.value)}
            placeholder="New watchlist name" className="input h-9 text-sm w-44"
            onKeyDown={e => e.key === 'Enter' && handleCreate()} />
          <button onClick={handleCreate} disabled={creating} className="btn-primary flex items-center gap-1 h-9 text-sm px-3">
            <FiPlus size={15} /> Create
          </button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {watchlists.map(wl => (
          <button key={wl._id} onClick={() => { setActiveList(wl); fetchQuotes(wl.symbols) }}
            className={clsx('px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors', activeList?._id === wl._id ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white')}>
            {wl.name} ({wl.symbols.length})
          </button>
        ))}
      </div>

      {activeList && (
        <div className="card p-0">
          <div className="p-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="font-semibold text-white">{activeList.name}</h2>
            <button onClick={() => fetchQuotes(activeList.symbols)} className="text-gray-400 hover:text-white transition-colors">
              <FiRefreshCw size={15} />
            </button>
          </div>
          {activeList.symbols.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              <FiTrendingUp size={32} className="mx-auto mb-2 opacity-30" />
              <p>No symbols yet. Search for stocks and add them.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {activeList.symbols.map(sym => {
                const q = quotes[sym.symbol]
                const up = (q?.changePercent || 0) >= 0
                return (
                  <div key={sym.symbol} className="flex items-center gap-4 p-4 hover:bg-gray-800/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <Link to={`/stock/${sym.symbol}`} className="font-semibold text-white hover:text-blue-400">{sym.symbol}</Link>
                      <p className="text-xs text-gray-500">{sym.name || q?.name}</p>
                    </div>
                    {q ? (
                      <>
                        <div className="text-right">
                          <p className="font-semibold text-white text-sm">{q.price?.toFixed(2)}</p>
                        </div>
                        <span className={clsx('text-xs font-medium px-2 py-0.5 rounded', up ? 'badge-up' : 'badge-down')}>
                          {up ? '+' : ''}{q.changePercent?.toFixed(2)}%
                        </span>
                      </>
                    ) : <div className="text-xs text-gray-600">Loading...</div>}
                    <button onClick={() => handleRemoveSymbol(activeList._id, sym.symbol)}
                      className="text-gray-600 hover:text-red-400 transition-colors">
                      <FiTrash2 size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {watchlists.length === 0 && (
        <div className="card py-16 text-center">
          <FiBookmark size={40} className="mx-auto mb-3 text-gray-700" />
          <h3 className="text-lg font-semibold text-gray-400">No watchlists yet</h3>
          <p className="text-gray-600 mt-1">Create your first watchlist above</p>
        </div>
      )}
    </div>
  )
}

function FiBookmark({ size, className }) { return <FiTrendingUp size={size} className={className} /> }

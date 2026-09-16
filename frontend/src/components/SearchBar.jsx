import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiSearch, FiTrendingUp } from 'react-icons/fi'
import { stockAPI } from '../services/api'
import { useDebounce } from '../hooks/useDebounce'

export default function SearchBar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const debouncedQuery = useDebounce(query, 300)
  const navigate = useNavigate()
  const ref = useRef(null)

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) { setResults([]); return }
    setLoading(true)
    stockAPI.search(debouncedQuery)
      .then(res => { setResults(res.data.results || []); setOpen(true) })
      .catch(() => setResults([]))
      .finally(() => setLoading(false))
  }, [debouncedQuery])

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (symbol) => {
    navigate(`/stock/${symbol}`)
    setQuery('')
    setOpen(false)
    setResults([])
  }

  const typeColors = { EQUITY: 'text-blue-400', MUTUALFUND: 'text-purple-400', ETF: 'text-green-400', INDEX: 'text-yellow-400' }

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={15} />
        <input
          type="text"
          placeholder="Search stocks, mutual funds, indices..."
          value={query}
          onChange={e => { setQuery(e.target.value); if (e.target.value) setOpen(true) }}
          onFocus={() => results.length && setOpen(true)}
          className="input pl-9 pr-4 py-2 text-sm h-9 bg-gray-800 border-gray-700"
        />
        {loading && <div className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 border-2 border-gray-500 border-t-blue-400 rounded-full animate-spin" />}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full mt-1 w-full bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-50 max-h-80 overflow-y-auto">
          {results.map(r => (
            <button key={r.symbol} onClick={() => handleSelect(r.symbol)}
              className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-800 transition-colors text-left border-b border-gray-800 last:border-0">
              <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0">
                <FiTrendingUp size={14} className="text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{r.symbol}</p>
                <p className="text-xs text-gray-400 truncate">{r.name}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-xs font-medium ${typeColors[r.type] || 'text-gray-400'}`}>{r.type}</p>
                <p className="text-xs text-gray-500">{r.exchange}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

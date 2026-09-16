import { useState } from 'react'
import { Link } from 'react-router-dom'
import { stockAPI } from '../services/api'
import { FiFilter, FiSearch, FiTrendingUp, FiTrendingDown } from 'react-icons/fi'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const EXCHANGES = ['NSE', 'BSE', 'NYSE', 'NASDAQ', 'LSE']
const SECTORS = ['Technology', 'Financial Services', 'Healthcare', 'Consumer Cyclical', 'Industrials', 'Energy', 'Basic Materials', 'Real Estate', 'Utilities', 'Communication Services']

export default function Screener() {
  const [filters, setFilters] = useState({ exchange: 'NSE', sector: '', minPE: '', maxPE: '', minMktCap: '', maxMktCap: '', sortBy: 'marketCap', order: 'desc', limit: 50 })
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const handleScreen = async () => {
    setLoading(true)
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''))
      const res = await stockAPI.screener(params)
      setResults(res.data.stocks || [])
      setSearched(true)
      if (!res.data.stocks?.length) toast('No stocks found for these criteria', { icon: 'ℹ️' })
    } catch (err) {
      toast.error(err.response?.data?.error || 'Screener failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Stock Screener</h1>
          <p className="text-gray-400 text-sm mt-0.5">Filter stocks across global exchanges</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <FiFilter className="text-blue-400" />
          <h2 className="font-semibold text-white">Filters</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Exchange</label>
            <select value={filters.exchange} onChange={e => setFilters(p => ({ ...p, exchange: e.target.value }))} className="input text-sm h-9">
              {EXCHANGES.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Sector</label>
            <select value={filters.sector} onChange={e => setFilters(p => ({ ...p, sector: e.target.value }))} className="input text-sm h-9">
              <option value="">All Sectors</option>
              {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Min P/E</label>
            <input type="number" value={filters.minPE} onChange={e => setFilters(p => ({ ...p, minPE: e.target.value }))} placeholder="e.g. 5" className="input text-sm h-9" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Max P/E</label>
            <input type="number" value={filters.maxPE} onChange={e => setFilters(p => ({ ...p, maxPE: e.target.value }))} placeholder="e.g. 50" className="input text-sm h-9" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Sort By</label>
            <select value={filters.sortBy} onChange={e => setFilters(p => ({ ...p, sortBy: e.target.value }))} className="input text-sm h-9">
              <option value="marketCap">Market Cap</option>
              <option value="regularMarketChangePercent">% Change</option>
              <option value="regularMarketVolume">Volume</option>
              <option value="trailingPE">P/E Ratio</option>
            </select>
          </div>
        </div>
        <button onClick={handleScreen} disabled={loading}
          className="btn-primary mt-4 flex items-center gap-2">
          <FiSearch size={15} /> {loading ? 'Screening...' : 'Screen Stocks'}
        </button>
      </div>

      {/* Results */}
      {searched && (
        <div className="card p-0">
          <div className="p-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="font-semibold text-white">{results.length} results found</h2>
            <span className="text-xs text-gray-500">{filters.exchange} Exchange</span>
          </div>
          {results.length === 0 ? (
            <div className="py-12 text-center text-gray-500">No stocks match the criteria</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-800">
                  {['Symbol', 'Name', 'Price', '% Change', 'Volume', 'Market Cap', 'P/E', 'Sector'].map(h => (
                    <th key={h} className="text-left text-xs text-gray-500 font-medium px-4 py-3">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {results.map(s => {
                    const up = (s.changePercent || 0) >= 0
                    return (
                      <tr key={s.symbol} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors cursor-pointer">
                        <td className="px-4 py-3"><Link to={`/stock/${s.symbol}`} className="font-semibold text-blue-400 hover:text-blue-300">{s.symbol}</Link></td>
                        <td className="px-4 py-3 text-gray-300 max-w-32 truncate">{s.name}</td>
                        <td className="px-4 py-3 text-white font-medium">{s.price?.toFixed(2)}</td>
                        <td className={clsx('px-4 py-3 font-medium', up ? 'text-green-400' : 'text-red-400')}>
                          {up ? '+' : ''}{s.changePercent?.toFixed(2)}%
                        </td>
                        <td className="px-4 py-3 text-gray-400">{formatVol(s.volume)}</td>
                        <td className="px-4 py-3 text-gray-400">{formatCap(s.marketCap)}</td>
                        <td className="px-4 py-3 text-gray-400">{s.pe?.toFixed(1) || '–'}</td>
                        <td className="px-4 py-3 text-gray-500 max-w-28 truncate">{s.sector || '–'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function formatVol(v) { if (!v) return '–'; if (v >= 1e7) return (v / 1e7).toFixed(1) + 'Cr'; if (v >= 1e5) return (v / 1e5).toFixed(1) + 'L'; return v?.toLocaleString() }
function formatCap(v) { if (!v) return '–'; if (v >= 1e12) return '₹' + (v / 1e12).toFixed(1) + 'T'; if (v >= 1e9) return '₹' + (v / 1e9).toFixed(1) + 'B'; if (v >= 1e7) return '₹' + (v / 1e7).toFixed(1) + 'Cr'; return '₹' + v?.toLocaleString() }

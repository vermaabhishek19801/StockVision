import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { stockAPI, predictionAPI, watchlistAPI } from '../services/api'
import { getSocket } from '../services/socket'
import useAuthStore from '../context/authStore'
import toast from 'react-hot-toast'
import CandlestickChart from '../components/CandlestickChart'
import { FiBookmark, FiPlus, FiZap, FiTrendingUp, FiTrendingDown, FiRefreshCw } from 'react-icons/fi'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import clsx from 'clsx'

const PERIODS = [
  { label: '1W', days: 7 }, { label: '1M', days: 30 }, { label: '3M', days: 90 },
  { label: '6M', days: 180 }, { label: '1Y', days: 365 }, { label: '5Y', days: 1825 }
]

export default function StockDetail() {
  const { symbol } = useParams()
  const { user } = useAuthStore()
  const [quote, setQuote] = useState(null)
  const [history, setHistory] = useState([])
  const [technicals, setTechnicals] = useState(null)
  const [fundamentals, setFundamentals] = useState(null)
  const [news, setNews] = useState([])
  const [prediction, setPrediction] = useState(null)
  const [predicting, setPredicting] = useState(false)
  const [period, setPeriod] = useState('3M')
  const [activeTab, setActiveTab] = useState('chart')
  const [loading, setLoading] = useState(true)
  const [watchlists, setWatchlists] = useState([])

  const fetchHistory = async (periodLabel) => {
    const days = PERIODS.find(p => p.label === periodLabel)?.days || 90
    const p1 = new Date(Date.now() - days * 864e5).toISOString().split('T')[0]
    const p2 = new Date().toISOString().split('T')[0]
    const interval = days <= 30 ? '1d' : days <= 180 ? '1d' : '1wk'
    try {
      const res = await stockAPI.getHistory(symbol, { period1: p1, period2: p2, interval })
      setHistory(res.data.history || [])
    } catch {}
  }

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)
      try {
        const [qRes, tRes, fRes, nRes, wRes] = await Promise.allSettled([
          stockAPI.getQuote(symbol),
          stockAPI.getTechnicals(symbol),
          stockAPI.getFundamentals(symbol),
          stockAPI.getNews(symbol),
          watchlistAPI.getAll()
        ])
        if (qRes.status === 'fulfilled') setQuote(qRes.value.data.quote)
        if (tRes.status === 'fulfilled') setTechnicals(tRes.value.data.technicals)
        if (fRes.status === 'fulfilled') setFundamentals(fRes.value.data.fundamentals)
        if (nRes.status === 'fulfilled') setNews(nRes.value.data.news || [])
        if (wRes.status === 'fulfilled') setWatchlists(wRes.value.data.watchlists || [])
        await fetchHistory('3M')
      } finally {
        setLoading(false)
      }
    }
    fetchAll()

    // Live quote updates
    const socket = getSocket()
    socket.emit('subscribe', symbol)
    socket.on('quote', (data) => {
      if (data.symbol === symbol.toUpperCase()) setQuote(prev => prev ? { ...prev, ...data } : data)
    })
    return () => { socket.emit('unsubscribe', symbol); socket.off('quote') }
  }, [symbol])

  const handlePredict = async () => {
    setPredicting(true)
    try {
      const res = await predictionAPI.predict({ symbol, timeframe: '1m' })
      setPrediction(res.data.prediction)
      toast.success('AI prediction generated!')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Prediction failed')
    } finally {
      setPredicting(false)
    }
  }

  const handleAddToWatchlist = async () => {
    if (!watchlists.length) { toast.error('Create a watchlist first'); return }
    try {
      await watchlistAPI.addSymbol(watchlists[0]._id, {
        symbol, name: quote?.name || symbol, exchange: quote?.exchange, type: 'stock'
      })
      toast.success(`${symbol} added to watchlist`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add to watchlist')
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="h-8 w-8 border-4 border-gray-700 border-t-blue-500 rounded-full animate-spin" /></div>
  if (!quote && !loading) return <div className="text-center text-gray-400 py-20"><p className="text-xl">Symbol not found: {symbol}</p><Link to="/dashboard" className="text-blue-400 mt-2 block">← Back to Dashboard</Link></div>

  const up = (quote?.changePercent || 0) >= 0

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{symbol}</h1>
            <span className="flex items-center gap-1 text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full live-dot" /> LIVE
            </span>
          </div>
          <p className="text-gray-400">{quote?.name || quote?.exchange}</p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-3xl font-bold text-white">
              {quote?.currency === 'INR' ? '₹' : '$'}{quote?.price?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </span>
            <span className={clsx('flex items-center gap-1 text-sm font-medium', up ? 'text-green-400' : 'text-red-400')}>
              {up ? <FiTrendingUp /> : <FiTrendingDown />}
              {up ? '+' : ''}{quote?.change?.toFixed(2)} ({up ? '+' : ''}{quote?.changePercent?.toFixed(2)}%)
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleAddToWatchlist} className="btn-secondary flex items-center gap-2">
            <FiPlus size={15} /> Watchlist
          </button>
          <button onClick={handlePredict} disabled={predicting} className="btn-primary flex items-center gap-2">
            <FiZap size={15} /> {predicting ? 'Analyzing...' : 'AI Predict'}
          </button>
        </div>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          ['Open', quote?.open?.toFixed(2)],
          ['High', quote?.high?.toFixed(2)],
          ['Low', quote?.low?.toFixed(2)],
          ['Close', quote?.close?.toFixed(2)],
          ['Volume', formatVolume(quote?.volume)],
          ['Mkt Cap', formatMktCap(quote?.marketCap)],
          ['P/E', quote?.pe?.toFixed(2)],
          ['52W H', quote?.fiftyTwoWeekHigh?.toFixed(2)],
          ['52W L', quote?.fiftyTwoWeekLow?.toFixed(2)],
          ['EPS', quote?.eps?.toFixed(2)]
        ].map(([label, val]) => (
          <div key={label} className="bg-gray-900 rounded-lg p-3 border border-gray-800">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className="text-sm font-semibold text-white">{val || '–'}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="card p-0 overflow-hidden">
        <div className="flex border-b border-gray-800">
          {['chart', 'technicals', 'fundamentals', 'news'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={clsx('px-5 py-3 text-sm font-medium capitalize transition-colors', activeTab === tab ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-400/5' : 'text-gray-400 hover:text-white')}>
              {tab}
            </button>
          ))}
        </div>

        <div className="p-4">
          {activeTab === 'chart' && (
            <div>
              <div className="flex gap-2 mb-4">
                {PERIODS.map(p => (
                  <button key={p.label} onClick={() => { setPeriod(p.label); fetchHistory(p.label) }}
                    className={clsx('px-3 py-1 rounded text-xs font-medium transition-colors', period === p.label ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white')}>
                    {p.label}
                  </button>
                ))}
              </div>
              <CandlestickChart data={history} height={380} />
            </div>
          )}

          {activeTab === 'technicals' && technicals && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[
                { label: 'RSI (14)', value: technicals.rsi?.toFixed(2), signal: technicals.signal },
                { label: 'SMA 20', value: technicals.sma20?.toFixed(2) },
                { label: 'SMA 50', value: technicals.sma50?.toFixed(2) },
                { label: 'SMA 200', value: technicals.sma200?.toFixed(2) },
                { label: 'EMA 12', value: technicals.ema12?.toFixed(2) },
                { label: 'EMA 26', value: technicals.ema26?.toFixed(2) },
                { label: 'MACD', value: technicals.macd?.macd?.toFixed(4) },
                { label: 'BB Upper', value: technicals.bollingerBands?.upper?.toFixed(2) },
                { label: 'BB Lower', value: technicals.bollingerBands?.lower?.toFixed(2) },
                { label: 'Trend', value: technicals.trend, signal: technicals.trend },
                { label: 'vs SMA 20', value: `${technicals.priceVsSMA20}%` },
                { label: 'vs SMA 50', value: `${technicals.priceVsSMA50}%` }
              ].map(item => (
                <div key={item.label} className="bg-gray-800/50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">{item.label}</p>
                  <p className={clsx('text-sm font-bold',
                    item.signal === 'bullish' || item.signal === 'oversold' ? 'text-green-400' :
                    item.signal === 'bearish' || item.signal === 'overbought' ? 'text-red-400' : 'text-white')}>
                    {item.value || '–'}
                  </p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'fundamentals' && fundamentals && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {fundamentals.profile && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">Company Profile</h3>
                  <div className="space-y-2 text-sm">
                    {[['Sector', fundamentals.profile.sector], ['Industry', fundamentals.profile.industry],
                      ['Country', fundamentals.profile.country], ['Employees', fundamentals.profile.employees?.toLocaleString()]].map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="text-gray-500">{k}</span><span className="text-white">{v || '–'}</span>
                      </div>
                    ))}
                    {fundamentals.profile.description && <p className="text-gray-400 text-xs mt-3 leading-relaxed">{fundamentals.profile.description}</p>}
                  </div>
                </div>
              )}
              {fundamentals.financials && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">Financial Metrics</h3>
                  <div className="space-y-2 text-sm">
                    {[['Revenue', formatMktCap(fundamentals.financials.revenue)],
                      ['Net Income', formatMktCap(fundamentals.financials.netIncome)],
                      ['Profit Margin', formatPct(fundamentals.financials.profitMargin)],
                      ['ROE', formatPct(fundamentals.financials.returnOnEquity)],
                      ['ROA', formatPct(fundamentals.financials.returnOnAssets)],
                      ['Debt/Equity', fundamentals.financials.debtToEquity?.toFixed(2)],
                      ['Current Ratio', fundamentals.financials.currentRatio?.toFixed(2)]].map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="text-gray-500">{k}</span><span className="text-white">{v || '–'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'news' && (
            <div className="space-y-3">
              {news.length === 0 && <p className="text-gray-500 text-sm">No news available</p>}
              {news.map((n, i) => (
                <a key={i} href={n.link} target="_blank" rel="noopener noreferrer"
                  className="flex gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors border border-gray-800">
                  {n.thumbnail && <img src={n.thumbnail} className="w-16 h-12 object-cover rounded flex-shrink-0" alt="" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white line-clamp-2">{n.title}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      <span>{n.publisher}</span>
                      <span>•</span>
                      <span>{new Date(n.providerPublishTime * 1000).toLocaleDateString('en-IN')}</span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* AI Prediction Panel */}
      {prediction && <PredictionPanel prediction={prediction.prediction || prediction} symbol={symbol} />}
    </div>
  )
}

function PredictionPanel({ prediction, symbol }) {
  const dirColor = prediction?.direction === 'bullish' ? 'text-green-400' : prediction?.direction === 'bearish' ? 'text-red-400' : 'text-yellow-400'
  const recColors = { strong_buy: 'text-green-400 bg-green-400/10', buy: 'text-green-300 bg-green-300/10', hold: 'text-yellow-400 bg-yellow-400/10', sell: 'text-red-300 bg-red-300/10', strong_sell: 'text-red-400 bg-red-400/10' }

  return (
    <div className="card border-blue-600/30 bg-blue-950/20">
      <div className="flex items-center gap-2 mb-4">
        <FiZap className="text-blue-400" />
        <h2 className="font-semibold text-white">AI Prediction for {symbol}</h2>
        <span className="text-xs text-gray-500 ml-auto">{prediction.provider || 'AI'} • {prediction.timeframe}</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="bg-gray-800/50 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1">Direction</p>
          <p className={`text-base font-bold capitalize ${dirColor}`}>{prediction.direction}</p>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1">Target Price</p>
          <p className="text-base font-bold text-white">{prediction.targetPrice}</p>
          <p className="text-xs text-gray-500">{prediction.targetPriceLow} – {prediction.targetPriceHigh}</p>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1">Confidence</p>
          <p className="text-base font-bold text-white">{prediction.confidence}%</p>
          <div className="mt-1 h-1 bg-gray-700 rounded-full"><div className="h-1 bg-blue-500 rounded-full" style={{ width: `${prediction.confidence}%` }} /></div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1">Recommendation</p>
          <span className={`text-sm font-bold px-2 py-0.5 rounded capitalize ${recColors[prediction.recommendation] || 'text-gray-400'}`}>
            {prediction.recommendation?.replace('_', ' ')}
          </span>
        </div>
      </div>

      <p className="text-sm text-gray-300 leading-relaxed mb-3">{prediction.rationale}</p>

      {prediction.keyFactors?.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">Key Factors</p>
          <div className="flex flex-wrap gap-2">
            {prediction.keyFactors.map((f, i) => <span key={i} className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded-full border border-gray-700">{f}</span>)}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-600 mt-4">⚠ This is AI-generated analysis for informational purposes only. Not financial advice. Always do your own research.</p>
    </div>
  )
}

function formatVolume(v) {
  if (!v) return '–'
  if (v >= 1e7) return (v / 1e7).toFixed(2) + 'Cr'
  if (v >= 1e5) return (v / 1e5).toFixed(2) + 'L'
  return v.toLocaleString()
}

function formatMktCap(v) {
  if (!v) return '–'
  if (v >= 1e12) return '₹' + (v / 1e12).toFixed(2) + 'T'
  if (v >= 1e9) return '₹' + (v / 1e9).toFixed(2) + 'B'
  if (v >= 1e7) return '₹' + (v / 1e7).toFixed(2) + 'Cr'
  return '₹' + v.toLocaleString()
}

function formatPct(v) {
  return v ? (v * 100).toFixed(2) + '%' : '–'
}

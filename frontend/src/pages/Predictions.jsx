import { useState } from 'react'
import { predictionAPI } from '../services/api'
import useAuthStore from '../context/authStore'
import toast from 'react-hot-toast'
import { FiZap, FiLock } from 'react-icons/fi'
import clsx from 'clsx'

const TIMEFRAMES = ['1d', '1w', '1m', '3m', '6m', '1y']

export default function Predictions() {
  const { user } = useAuthStore()
  const [symbol, setSymbol] = useState('')
  const [timeframe, setTimeframe] = useState('1m')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const hasAI = user?.subscription?.features?.aiPredictions

  const handlePredict = async () => {
    if (!symbol.trim()) { toast.error('Enter a symbol'); return }
    setLoading(true)
    try {
      const res = await predictionAPI.predict({ symbol: symbol.toUpperCase(), timeframe })
      setResult(res.data.prediction)
      toast.success('Prediction ready!')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Prediction failed')
    } finally { setLoading(false) }
  }

  const pred = result?.prediction || result

  const dirColor = { bullish: 'text-green-400', bearish: 'text-red-400', neutral: 'text-yellow-400' }
  const recStyles = {
    strong_buy: 'text-green-400 bg-green-400/10 border-green-400/30',
    buy: 'text-green-300 bg-green-300/10 border-green-300/30',
    hold: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
    sell: 'text-red-300 bg-red-300/10 border-red-300/30',
    strong_sell: 'text-red-400 bg-red-400/10 border-red-400/30'
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><FiZap className="text-blue-400" /> AI Predictions</h1>
        <p className="text-gray-400 text-sm mt-1">
          {hasAI ? 'Powered by IBM WatsonX AI' : 'Basic analysis available — upgrade to Pro for full AI predictions'}
        </p>
      </div>

      {!hasAI && (
        <div className="card border-yellow-500/20 bg-yellow-950/10 flex items-start gap-3">
          <FiLock className="text-yellow-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-yellow-300 font-medium text-sm">Upgrade to Pro for AI Predictions</p>
            <p className="text-gray-400 text-xs mt-1">Full AI predictions are powered by IBM WatsonX and require Pro or Enterprise plan. You're currently seeing rule-based analysis.</p>
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="font-semibold text-white mb-4">Analyze a Stock</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={symbol}
            onChange={e => setSymbol(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handlePredict()}
            placeholder="Enter symbol (e.g. RELIANCE.NS, AAPL, ^NSEI)"
            className="input flex-1"
          />
          <div className="flex gap-2">
            {TIMEFRAMES.map(tf => (
              <button key={tf} onClick={() => setTimeframe(tf)}
                className={clsx('px-3 py-2 rounded-lg text-xs font-medium transition-colors', timeframe === tf ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white')}>
                {tf}
              </button>
            ))}
          </div>
          <button onClick={handlePredict} disabled={loading} className="btn-primary flex items-center gap-2 whitespace-nowrap">
            <FiZap size={15} /> {loading ? 'Analyzing...' : 'Predict'}
          </button>
        </div>
      </div>

      {result && pred && (
        <div className="card space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-white text-lg">{result.symbol} — {timeframe} Analysis</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">{result.provider || 'AI'}</span>
              {result.fromCache && <span className="text-xs bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full">Cached</span>}
            </div>
          </div>

          {/* Core metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-800/50 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-500 mb-2">Direction</p>
              <p className={`text-2xl font-bold capitalize ${dirColor[pred.direction] || 'text-white'}`}>{pred.direction}</p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-500 mb-2">Target Price</p>
              <p className="text-xl font-bold text-white">{pred.targetPrice}</p>
              <p className="text-xs text-gray-500 mt-1">{pred.targetPriceLow} – {pred.targetPriceHigh}</p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-500 mb-2">Confidence</p>
              <p className="text-2xl font-bold text-white">{pred.confidence}%</p>
              <div className="mt-2 h-1.5 bg-gray-700 rounded-full"><div className="h-1.5 bg-blue-500 rounded-full transition-all" style={{ width: `${pred.confidence}%` }} /></div>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-500 mb-2">Recommendation</p>
              <span className={clsx('text-sm font-bold px-3 py-1.5 rounded-lg border capitalize', recStyles[pred.recommendation] || 'text-gray-400 bg-gray-800')}>
                {pred.recommendation?.replace('_', ' ')}
              </span>
            </div>
          </div>

          {/* Risk level */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">Risk Level:</span>
            <span className={clsx('text-xs font-semibold px-2.5 py-1 rounded-full border capitalize',
              pred.riskLevel === 'low' ? 'text-green-400 bg-green-400/10 border-green-400/20' :
              pred.riskLevel === 'high' ? 'text-red-400 bg-red-400/10 border-red-400/20' :
              'text-yellow-400 bg-yellow-400/10 border-yellow-400/20')}>
              {pred.riskLevel} risk
            </span>
          </div>

          {/* Rationale */}
          <div className="bg-gray-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-2">Analysis</p>
            <p className="text-sm text-gray-300 leading-relaxed">{pred.rationale}</p>
          </div>

          {/* Key factors */}
          {pred.keyFactors?.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Key Factors</p>
              <div className="flex flex-wrap gap-2">
                {pred.keyFactors.map((f, i) => (
                  <span key={i} className="text-xs bg-gray-800 border border-gray-700 text-gray-300 px-3 py-1 rounded-full">{f}</span>
                ))}
              </div>
            </div>
          )}

          {/* Support/Resistance */}
          {(pred.supportLevels?.length > 0 || pred.resistanceLevels?.length > 0) && (
            <div className="grid grid-cols-2 gap-4">
              {pred.supportLevels?.length > 0 && (
                <div className="bg-green-950/20 border border-green-500/20 rounded-lg p-3">
                  <p className="text-xs text-green-400/70 mb-1">Support Levels</p>
                  <div className="flex gap-2">{pred.supportLevels.map((l, i) => <span key={i} className="text-sm font-semibold text-green-400">{l}</span>)}</div>
                </div>
              )}
              {pred.resistanceLevels?.length > 0 && (
                <div className="bg-red-950/20 border border-red-500/20 rounded-lg p-3">
                  <p className="text-xs text-red-400/70 mb-1">Resistance Levels</p>
                  <div className="flex gap-2">{pred.resistanceLevels.map((l, i) => <span key={i} className="text-sm font-semibold text-red-400">{l}</span>)}</div>
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-gray-600 border-t border-gray-800 pt-3">⚠ AI-generated analysis for informational purposes only. Not financial advice. Past performance is not indicative of future results. Always conduct your own research before making investment decisions.</p>
        </div>
      )}
    </div>
  )
}

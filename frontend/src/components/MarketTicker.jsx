import { useEffect, useState, useRef } from 'react'
import { marketAPI } from '../services/api'

export default function MarketTicker() {
  const [indices, setIndices] = useState([])
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    marketAPI.getIndices().then(res => setIndices(res.data.indices || [])).catch(() => {})
    const interval = setInterval(() => {
      marketAPI.getIndices().then(res => setIndices(res.data.indices || [])).catch(() => {})
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  if (!indices.length) return null

  return (
    <div
      className="bg-gray-900 border-b border-gray-800 h-8 flex items-center overflow-hidden cursor-pointer"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex items-center gap-0 whitespace-nowrap"
        style={{ animation: paused ? 'none' : 'ticker 40s linear infinite', display: 'flex', width: 'max-content' }}>
        {[...indices, ...indices].map((idx, i) => {
          const up = (idx.changePercent || 0) >= 0
          return (
            <span key={i} className="inline-flex items-center gap-2 px-5 border-r border-gray-800 text-xs">
              <span className="text-gray-300 font-medium">{idx.name || idx.symbol}</span>
              <span className="text-white font-semibold">{idx.price?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              <span className={up ? 'text-green-400' : 'text-red-400'}>
                {up ? '▲' : '▼'} {Math.abs(idx.changePercent || 0).toFixed(2)}%
              </span>
            </span>
          )
        })}
      </div>
      <style>{`@keyframes ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }`}</style>
    </div>
  )
}

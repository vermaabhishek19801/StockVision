import { useEffect, useRef } from 'react'
import { createChart, ColorType } from 'lightweight-charts'

export default function CandlestickChart({ data, height = 400 }) {
  const containerRef = useRef(null)
  const chartRef = useRef(null)
  const seriesRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current || !data?.length) return

    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#111827' }, textColor: '#9ca3af' },
      grid: { vertLines: { color: '#1f2937' }, horzLines: { color: '#1f2937' } },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: '#374151' },
      timeScale: { borderColor: '#374151', timeVisible: true },
      height,
      width: containerRef.current.clientWidth
    })

    chartRef.current = chart

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444'
    })
    seriesRef.current = candleSeries

    const formatted = data.map(d => ({
      time: typeof d.date === 'string' ? d.date : new Date(d.date).toISOString().split('T')[0],
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close
    })).filter(d => d.open && d.high && d.low && d.close)

    candleSeries.setData(formatted)
    chart.timeScale().fitContent()

    const handleResize = () => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth })
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [data, height])

  return <div ref={containerRef} className="w-full rounded-lg overflow-hidden" style={{ height }} />
}

import { useEffect, useState } from 'react'
import { adminAPI } from '../../services/api'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { FiPlus, FiTrash2, FiSettings, FiRefreshCw } from 'react-icons/fi'

const PROVIDERS = ['yahoo', 'alpha_vantage', 'finnhub', 'polygon', 'twelve_data', 'custom']

const DEFAULT_CONFIG = {
  key: '', label: '', exchange: 'NSE', baseUrl: '', dataProvider: 'yahoo',
  isActive: true, fetchInterval: 30, rateLimitPerMinute: 60,
  customEndpoints: { quote: '', history: '', search: '', indices: '' }
}

export default function AdminConfig() {
  const [configs, setConfigs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(DEFAULT_CONFIG)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    adminAPI.getMarketConfig()
      .then(res => setConfigs(res.data.configs || []))
      .finally(() => setLoading(false))
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.key.trim()) { toast.error('Config key is required'); return }
    setSaving(true)
    try {
      const res = await adminAPI.upsertMarketConfig(form)
      const existing = configs.find(c => c.key === form.key)
      if (existing) {
        setConfigs(p => p.map(c => c.key === form.key ? res.data.config : c))
      } else {
        setConfigs(p => [...p, res.data.config])
      }
      toast.success(`Config "${form.key}" saved`)
      setShowForm(false)
      setForm(DEFAULT_CONFIG)
    } catch (err) { toast.error(err.response?.data?.error || 'Save failed') }
    finally { setSaving(false) }
  }

  const handleDelete = async (key) => {
    if (!confirm(`Delete config "${key}"?`)) return
    try {
      await api.delete(`/config/${key}`)
      setConfigs(p => p.filter(c => c.key !== key))
      toast.success('Config deleted')
    } catch { toast.error('Delete failed') }
  }

  const handleEdit = (config) => {
    setForm({ ...DEFAULT_CONFIG, ...config })
    setShowForm(true)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><FiSettings /> Market Configuration</h1>
          <p className="text-gray-400 text-sm mt-0.5">Configure data providers for NSE, BSE, and global exchanges</p>
        </div>
        <button onClick={() => { setForm(DEFAULT_CONFIG); setShowForm(p => !p) }} className="btn-primary flex items-center gap-1 text-sm h-9 px-3">
          <FiPlus size={15} /> Add Config
        </button>
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="card border-blue-600/30 space-y-4">
          <h2 className="font-semibold text-white">{form._id ? 'Edit' : 'New'} Market Configuration</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Config Key *</label>
              <input value={form.key} onChange={e => setForm(p => ({ ...p, key: e.target.value.toUpperCase() }))} placeholder="e.g. NSE" className="input text-sm" required />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Display Label</label>
              <input value={form.label} onChange={e => setForm(p => ({ ...p, label: e.target.value }))} placeholder="e.g. National Stock Exchange" className="input text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Exchange</label>
              <select value={form.exchange} onChange={e => setForm(p => ({ ...p, exchange: e.target.value }))} className="input text-sm">
                {['NSE', 'BSE', 'NYSE', 'NASDAQ', 'LSE', 'OTHER'].map(ex => <option key={ex} value={ex}>{ex}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Data Provider</label>
              <select value={form.dataProvider} onChange={e => setForm(p => ({ ...p, dataProvider: e.target.value }))} className="input text-sm">
                {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Base URL</label>
              <input value={form.baseUrl} onChange={e => setForm(p => ({ ...p, baseUrl: e.target.value }))} placeholder="https://api.example.com" className="input text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Fetch Interval (sec)</label>
              <input type="number" value={form.fetchInterval} onChange={e => setForm(p => ({ ...p, fetchInterval: parseInt(e.target.value) }))} className="input text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Rate Limit (req/min)</label>
              <input type="number" value={form.rateLimitPerMinute} onChange={e => setForm(p => ({ ...p, rateLimitPerMinute: parseInt(e.target.value) }))} className="input text-sm" />
            </div>
          </div>

          {form.dataProvider === 'custom' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400 font-medium">Custom Endpoints</p>
              <div className="grid grid-cols-2 gap-3">
                {['quote', 'history', 'search', 'indices'].map(ep => (
                  <div key={ep}>
                    <label className="block text-xs text-gray-500 mb-1 capitalize">{ep} endpoint</label>
                    <input value={form.customEndpoints[ep]} onChange={e => setForm(p => ({ ...p, customEndpoints: { ...p.customEndpoints, [ep]: e.target.value } }))}
                      placeholder={`/api/${ep}?symbol={symbol}`} className="input text-sm" />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input type="checkbox" id="isActive" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} className="w-4 h-4 rounded bg-gray-800" />
            <label htmlFor="isActive" className="text-sm text-gray-300">Active (enabled for data fetching)</label>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Configuration'}</button>
          </div>
        </form>
      )}

      {/* Config list */}
      {loading ? (
        <div className="flex justify-center h-32 items-center"><div className="h-8 w-8 border-4 border-gray-700 border-t-purple-500 rounded-full animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {configs.length === 0 && (
            <div className="card col-span-3 py-12 text-center text-gray-500">
              <FiSettings size={32} className="mx-auto mb-2 opacity-20" />
              <p>No market configurations yet. Add your first one above.</p>
            </div>
          )}
          {configs.map(config => (
            <div key={config.key} className={`card border ${config.isActive ? 'border-green-600/20' : 'border-gray-700 opacity-60'}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white">{config.key}</h3>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${config.isActive ? 'text-green-400 bg-green-400/10' : 'text-gray-500 bg-gray-800'}`}>
                      {config.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{config.label || config.exchange}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(config)} className="text-gray-400 hover:text-blue-400 transition-colors"><FiSettings size={14} /></button>
                  <button onClick={() => handleDelete(config.key)} className="text-gray-400 hover:text-red-400 transition-colors"><FiTrash2 size={14} /></button>
                </div>
              </div>
              <div className="space-y-1.5 text-xs text-gray-500">
                <div className="flex justify-between"><span>Provider</span><span className="text-gray-300 capitalize">{config.dataProvider}</span></div>
                <div className="flex justify-between"><span>Interval</span><span className="text-gray-300">{config.fetchInterval}s</span></div>
                <div className="flex justify-between"><span>Rate Limit</span><span className="text-gray-300">{config.rateLimitPerMinute}/min</span></div>
                {config.baseUrl && <div className="truncate"><span className="text-gray-600">URL: </span><span className="text-gray-400">{config.baseUrl}</span></div>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card bg-gray-900/50 text-sm text-gray-400 space-y-1">
        <p className="font-medium text-gray-300">📡 NSE/BSE Configuration Notes</p>
        <p>• NSE default: <code className="text-blue-400">https://www.nseindia.com/api</code></p>
        <p>• BSE default: <code className="text-blue-400">https://api.bseindia.com/BseIndiaAPI/api</code></p>
        <p>• Yahoo Finance is used as primary/fallback source for all symbols globally</p>
        <p>• Custom provider: configure endpoints with <code className="text-blue-400">{'{symbol}'}</code> placeholder</p>
      </div>
    </div>
  )
}

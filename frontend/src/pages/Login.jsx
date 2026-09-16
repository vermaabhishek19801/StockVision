import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authAPI } from '../services/api'
import useAuthStore from '../context/authStore'
import toast from 'react-hot-toast'
import { FiTrendingUp, FiMail, FiLock, FiEye, FiEyeOff, FiShield } from 'react-icons/fi'

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [showPwd, setShowPwd] = useState(false)
  const [twoFA, setTwoFA] = useState(null)   // { tempToken } when 2FA is required
  const [totpToken, setTotpToken] = useState('')
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await authAPI.login(form)
      if (res.data.requires2FA) {
        setTwoFA({ tempToken: res.data.tempToken })
        return
      }
      setAuth(res.data.user, res.data.accessToken)
      toast.success(`Welcome back, ${res.data.user.name}!`)
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handle2FA = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await authAPI.validate2FA(twoFA.tempToken, totpToken)
      setAuth(res.data.user, res.data.accessToken)
      if (res.data.warning) toast.error(res.data.warning, { duration: 6000 })
      toast.success(`Welcome back, ${res.data.user.name}!`)
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid code')
    } finally {
      setLoading(false)
    }
  }

  // ── 2FA Challenge screen ───────────────────────────────────────────────────
  if (twoFA) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-600 rounded-2xl mb-4">
              <FiShield size={32} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Two-Factor Authentication</h1>
            <p className="text-gray-400 mt-1">Enter the code from your authenticator app</p>
          </div>

          <div className="card p-6">
            <form onSubmit={handle2FA} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">6-digit code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={8}
                  value={totpToken}
                  onChange={e => setTotpToken(e.target.value.replace(/\s/g, ''))}
                  className="input w-full text-center text-2xl tracking-widest"
                  placeholder="000000"
                  required
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">
                  No access to your phone? Use a backup code instead.
                </p>
              </div>
              <button type="submit" disabled={loading || totpToken.length < 6} className="btn-primary w-full">
                {loading ? 'Verifying…' : 'Verify'}
              </button>
            </form>
            <button onClick={() => { setTwoFA(null); setTotpToken('') }}
              className="w-full mt-3 text-sm text-gray-500 hover:text-gray-300">
              ← Use a different account
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Normal login ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <FiTrendingUp size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">StockVision</h1>
          <p className="text-gray-400 mt-1">AI-Powered Stock Intelligence</p>
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-semibold text-white mb-6">Sign in to your account</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Email</label>
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={15} />
                <input
                  type="email" required
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="you@example.com"
                  className="input pl-9"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Password</label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={15} />
                <input
                  type={showPwd ? 'text' : 'password'} required
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="••••••••"
                  className="input pl-9 pr-10"
                />
                <button type="button" onClick={() => setShowPwd(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showPwd ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-gray-400 cursor-pointer">
                <input type="checkbox" className="rounded bg-gray-800 border-gray-700" />
                Remember me
              </label>
              <Link to="/forgot-password" className="text-blue-400 hover:text-blue-300">Forgot password?</Link>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-400 mt-4">
            Don't have an account?{' '}
            <Link to="/register" className="text-blue-400 hover:text-blue-300 font-medium">Create account</Link>
          </p>
        </div>

        <p className="text-center text-xs text-gray-600 mt-4">
          NSE • BSE • NYSE • NASDAQ • LSE • Global Markets
        </p>
      </div>
    </div>
  )
}

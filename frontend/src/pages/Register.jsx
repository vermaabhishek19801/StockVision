import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authAPI } from '../services/api'
import useAuthStore from '../context/authStore'
import toast from 'react-hot-toast'
import { FiTrendingUp, FiUser, FiMail, FiLock, FiEye, FiEyeOff, FiCheck } from 'react-icons/fi'

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [showPwd, setShowPwd] = useState(false)
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  const passwordChecks = [
    { label: 'At least 8 characters', ok: form.password.length >= 8 },
    { label: 'One uppercase letter', ok: /[A-Z]/.test(form.password) },
    { label: 'One lowercase letter', ok: /[a-z]/.test(form.password) },
    { label: 'One number', ok: /\d/.test(form.password) }
  ]

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== form.confirm) { toast.error('Passwords do not match'); return }
    if (!passwordChecks.every(c => c.ok)) { toast.error('Password does not meet requirements'); return }
    setLoading(true)
    try {
      const res = await authAPI.register({ name: form.name, email: form.email, password: form.password })
      setAuth(res.data.user, res.data.accessToken)
      toast.success('Account created! Welcome to StockVision.')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <FiTrendingUp size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">StockVision</h1>
          <p className="text-gray-400 mt-1">AI-Powered Stock Intelligence</p>
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-semibold text-white mb-6">Create your account</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Full Name</label>
              <div className="relative">
                <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={15} />
                <input type="text" required value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="John Doe" className="input pl-9" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Email</label>
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={15} />
                <input type="email" required value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="you@example.com" className="input pl-9" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Password</label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={15} />
                <input type={showPwd ? 'text' : 'password'} required value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="••••••••" className="input pl-9 pr-10" />
                <button type="button" onClick={() => setShowPwd(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showPwd ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                </button>
              </div>
              {form.password && (
                <div className="mt-2 grid grid-cols-2 gap-1">
                  {passwordChecks.map(c => (
                    <div key={c.label} className={`flex items-center gap-1.5 text-xs ${c.ok ? 'text-green-400' : 'text-gray-500'}`}>
                      <FiCheck size={11} />
                      {c.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Confirm Password</label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={15} />
                <input type="password" required value={form.confirm}
                  onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))}
                  placeholder="••••••••" className="input pl-9" />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-400 mt-4">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium">Sign in</Link>
          </p>
        </div>

        <p className="text-xs text-gray-600 text-center mt-3">
          Free plan available • No credit card required
        </p>
      </div>
    </div>
  )
}

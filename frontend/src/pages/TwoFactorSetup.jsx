import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authAPI } from '../services/api'
import { FiShield, FiSmartphone, FiCopy, FiCheck, FiAlertTriangle } from 'react-icons/fi'

// Step 1: Setup — get QR code
// Step 2: Verify — enter TOTP once to confirm
// Step 3: Done — show backup codes

export default function TwoFactorSetup() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [backupCodes, setBackupCodes] = useState([])
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const startSetup = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await authAPI.setup2FA()
      setQrCode(res.data.qrCode)
      setSecret(res.data.manualCode)
      setBackupCodes(res.data.backupCodes || [])
      setStep(2)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start 2FA setup')
    } finally {
      setLoading(false)
    }
  }

  const verifyToken = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await authAPI.verify2FA(token)
      setStep(3)
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid code. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-purple-600 flex items-center justify-center mx-auto mb-4">
            <FiShield size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Two-Factor Authentication</h1>
          <p className="text-gray-400 mt-2">Add an extra layer of security to your account</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map(s => (
            <div key={s} className={`flex items-center gap-2 ${s < 3 ? 'flex-1' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                ${step >= s ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-500'}`}>
                {step > s ? '✓' : s}
              </div>
              {s < 3 && <div className={`flex-1 h-0.5 ${step > s ? 'bg-blue-600' : 'bg-gray-800'}`} />}
            </div>
          ))}
        </div>

        <div className="card">
          {/* STEP 1: Introduction */}
          {step === 1 && (
            <div className="text-center space-y-6">
              <FiSmartphone size={48} className="mx-auto text-blue-400" />
              <div>
                <h2 className="text-lg font-semibold text-white mb-2">Set up authenticator app</h2>
                <p className="text-gray-400 text-sm">
                  Install Google Authenticator, Authy, or any TOTP-compatible app on your phone.
                  Then click below to generate your QR code.
                </p>
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button onClick={startSetup} disabled={loading} className="btn-primary w-full">
                {loading ? 'Generating…' : 'Get Started'}
              </button>
            </div>
          )}

          {/* STEP 2: Scan QR + verify */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-white mb-1">Scan QR code</h2>
                <p className="text-gray-400 text-sm">Open your authenticator app and scan the code below.</p>
              </div>

              {qrCode && (
                <div className="flex justify-center">
                  <img src={qrCode} alt="TOTP QR Code" className="w-48 h-48 rounded-lg bg-white p-2" />
                </div>
              )}

              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Can't scan? Enter this code manually:</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs text-blue-300 flex-1 break-all">{secret}</code>
                  <button onClick={() => { navigator.clipboard.writeText(secret); }}
                    className="text-gray-400 hover:text-white flex-shrink-0">
                    <FiCopy size={14} />
                  </button>
                </div>
              </div>

              <form onSubmit={verifyToken} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Enter 6-digit code to verify</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={token}
                    onChange={e => setToken(e.target.value.replace(/\D/g, ''))}
                    className="input w-full text-center text-2xl tracking-widest"
                    placeholder="000000"
                    required
                  />
                </div>
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <button type="submit" disabled={loading || token.length !== 6} className="btn-primary w-full">
                  {loading ? 'Verifying…' : 'Verify & Enable 2FA'}
                </button>
              </form>
            </div>
          )}

          {/* STEP 3: Backup codes */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="flex items-start gap-3 bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-4">
                <FiAlertTriangle className="text-yellow-400 flex-shrink-0 mt-0.5" size={18} />
                <div>
                  <p className="text-yellow-300 font-medium text-sm">Save your backup codes!</p>
                  <p className="text-yellow-400/70 text-xs mt-1">
                    These are one-time use codes. Store them somewhere safe — you'll need them if you lose your phone.
                  </p>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-4 grid grid-cols-2 gap-2">
                {backupCodes.map((code, i) => (
                  <code key={i} className="text-sm text-green-300 font-mono">{code}</code>
                ))}
              </div>

              <button onClick={copyBackupCodes} className="btn-secondary w-full flex items-center justify-center gap-2">
                {copied ? <><FiCheck size={14} /> Copied!</> : <><FiCopy size={14} /> Copy Backup Codes</>}
              </button>

              <button onClick={() => navigate('/dashboard')} className="btn-primary w-full">
                Done — Go to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

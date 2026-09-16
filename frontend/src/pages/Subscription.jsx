import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { subscriptionAPI } from '../services/api'
import useAuthStore from '../context/authStore'
import toast from 'react-hot-toast'
import { FiCheck, FiZap, FiTrendingUp, FiShield, FiExternalLink, FiStar } from 'react-icons/fi'
import clsx from 'clsx'

const PLAN_ICONS = { free: FiTrendingUp, basic: FiTrendingUp, pro: FiZap, enterprise: FiShield }
const BADGE_COLORS = { Popular: 'bg-blue-600', 'Best Value': 'bg-purple-600' }

export default function Subscription() {
  const { user, updateUser } = useAuthStore()
  const [plans, setPlans] = useState([])
  const [upgrading, setUpgrading] = useState(null)
  const [searchParams] = useSearchParams()

  useEffect(() => {
    subscriptionAPI.getPlans().then(res => setPlans(res.data.plans || []))

    // Handle redirect back from Stripe
    if (searchParams.get('success')) {
      toast.success('🎉 Subscription activated! Your plan is now active.')
      // Refresh subscription status
      subscriptionAPI.getStatus().then(res => {
        if (res.data.subscription) updateUser({ subscription: res.data.subscription })
      }).catch(() => {})
    }
    if (searchParams.get('canceled')) {
      toast.error('Checkout canceled. No charges were made.')
    }
  }, [])

  const handleUpgrade = async (planId) => {
    if (planId === user?.subscription?.plan) return
    if (planId === 'free') {
      toast.error('To downgrade, contact support or cancel via the billing portal.')
      return
    }
    setUpgrading(planId)
    try {
      const res = await subscriptionAPI.checkout(planId)
      // Dev mode returns subscription directly (no Stripe)
      if (res.data.devMode) {
        updateUser({ subscription: res.data.subscription })
        toast.success(res.data.message)
        return
      }
      // Production: redirect to Stripe Checkout
      if (res.data.url) {
        window.location.href = res.data.url
        return
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Checkout failed')
    } finally {
      setUpgrading(null)
    }
  }

  const handlePortal = async () => {
    try {
      const res = await subscriptionAPI.portal()
      if (res.data.url) window.location.href = res.data.url
    } catch {
      toast.error('Billing portal unavailable (Stripe not configured in this environment)')
    }
  }

  const currentPlan = user?.subscription?.plan

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Subscription Plans</h1>
        <p className="text-gray-400 text-sm mt-1">Choose the plan that fits your trading needs</p>
      </div>

      {/* Current plan banner */}
      <div className="card border-blue-600/20 bg-blue-950/10 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm text-blue-300">
            You are on the <span className="font-bold capitalize">{currentPlan}</span> plan.
            {user?.subscription?.currentPeriodEnd &&
              <span className="text-gray-400 ml-1">
                Renews {new Date(user.subscription.currentPeriodEnd).toLocaleDateString('en-IN')}
              </span>
            }
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            Status: <span className={clsx('capitalize', user?.subscription?.status === 'active' ? 'text-green-400' : 'text-yellow-400')}>
              {user?.subscription?.status}
            </span>
          </p>
        </div>
        {currentPlan !== 'free' && (
          <button onClick={handlePortal}
            className="text-xs text-gray-400 hover:text-white flex items-center gap-1.5 border border-gray-700 px-3 py-1.5 rounded-lg">
            <FiExternalLink size={12} /> Manage Billing
          </button>
        )}
      </div>

      {/* Plan grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {plans.map(plan => {
          const isCurrent = plan.id === currentPlan
          const Icon = PLAN_ICONS[plan.id] || FiTrendingUp
          const badge = plan.badge

          return (
            <div key={plan.id} className={clsx(
              'card flex flex-col relative overflow-hidden transition-all hover:border-blue-600/50',
              badge === 'Popular' ? 'border-blue-600/50 bg-blue-950/20' : '',
              badge === 'Best Value' ? 'border-purple-600/50 bg-purple-950/10' : '',
              isCurrent ? 'border-green-600/50' : ''
            )}>
              {badge && (
                <div className="absolute top-0 left-0 right-0 h-0.5" style={{
                  background: badge === 'Popular' ? 'linear-gradient(to right, #2563eb, #7c3aed)' : 'linear-gradient(to right, #7c3aed, #ec4899)'
                }} />
              )}
              {badge && !isCurrent && (
                <div className={clsx('absolute top-3 right-3 text-xs text-white px-2 py-0.5 rounded-full font-medium flex items-center gap-1', BADGE_COLORS[badge])}>
                  <FiStar size={9} /> {badge}
                </div>
              )}
              {isCurrent && (
                <div className="absolute top-3 right-3 text-xs bg-green-600 text-white px-2 py-0.5 rounded-full font-medium">
                  Active
                </div>
              )}

              <div className="mb-4">
                <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center mb-3',
                  badge === 'Popular' ? 'bg-blue-600' : badge === 'Best Value' ? 'bg-purple-600' : 'bg-gray-800')}>
                  <Icon size={18} className="text-white" />
                </div>
                <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                <div className="mt-2">
                  {plan.price === 0 ? (
                    <span className="text-3xl font-bold text-white">Free</span>
                  ) : (
                    <>
                      <span className="text-3xl font-bold text-white">₹{plan.price.toLocaleString('en-IN')}</span>
                      <span className="text-gray-400 text-sm">/{plan.interval}</span>
                    </>
                  )}
                </div>
              </div>

              <ul className="space-y-2 flex-1 mb-6">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                    <FiCheck size={14} className="text-green-400 mt-0.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleUpgrade(plan.id)}
                disabled={isCurrent || upgrading === plan.id}
                className={clsx(
                  'w-full py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isCurrent ? 'bg-green-600/20 text-green-400 cursor-default' :
                  badge === 'Popular' ? 'bg-blue-600 hover:bg-blue-700 text-white' :
                  badge === 'Best Value' ? 'bg-purple-600 hover:bg-purple-700 text-white' :
                  plan.price === 0 ? 'bg-gray-800 text-gray-400 cursor-not-allowed' :
                  'bg-gray-700 hover:bg-gray-600 text-white',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}>
                {upgrading === plan.id ? 'Redirecting...' :
                 isCurrent ? 'Current Plan' :
                 plan.price === 0 ? 'Contact Support to Downgrade' : `Upgrade to ${plan.name}`}
              </button>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-gray-600 text-center">
        Secure payments via Stripe. 14-day money-back guarantee on all paid plans. Cancel anytime.
      </p>
    </div>
  )
}

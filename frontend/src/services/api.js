import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  withCredentials: true
})

// Response interceptor — silently refresh on 401 TOKEN_EXPIRED (L-4: no localStorage)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && error.response?.data?.code === 'TOKEN_EXPIRED' && !original._retry) {
      original._retry = true;
      try {
        const res = await axios.post('/api/auth/refresh', {}, { withCredentials: true });
        const { accessToken } = res.data;
        // L-4: memory only — no localStorage
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        original.headers['Authorization'] = `Bearer ${accessToken}`;
        return api(original);
      } catch {
        // Refresh failed — redirect to login
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
)

export const stockAPI = {
  search: (q) => api.get(`/stocks/search?q=${encodeURIComponent(q)}`),
  getQuote: (symbol, exchange) => api.get(`/stocks/quote/${symbol}${exchange ? `?exchange=${exchange}` : ''}`),
  getHistory: (symbol, params) => api.get(`/stocks/history/${symbol}`, { params }),
  getTechnicals: (symbol) => api.get(`/stocks/technicals/${symbol}`),
  getFundamentals: (symbol) => api.get(`/stocks/fundamentals/${symbol}`),
  getNews: (symbol) => api.get(`/stocks/news/${symbol}`),
  screener: (params) => api.get('/stocks/screener', { params })
}

export const marketAPI = {
  getIndices: () => api.get('/market/indices'),
  getGainers: () => api.get('/market/gainers'),
  getLosers: () => api.get('/market/losers'),
  getTrending: () => api.get('/market/trending')
}

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.patch(`/auth/reset-password/${token}`, { password }),
  // 2FA
  get2FAStatus: () => api.get('/auth/2fa/status'),
  setup2FA: () => api.post('/auth/2fa/setup'),
  verify2FA: (token) => api.post('/auth/2fa/verify', { token }),
  disable2FA: (token, password) => api.post('/auth/2fa/disable', { token, password }),
  validate2FA: (tempToken, totpToken) => api.post('/auth/2fa/validate', { tempToken, totpToken })
}

export const watchlistAPI = {
  getAll: () => api.get('/watchlist'),
  create: (name) => api.post('/watchlist', { name }),
  addSymbol: (id, data) => api.post(`/watchlist/${id}/symbols`, data),
  removeSymbol: (id, symbol) => api.delete(`/watchlist/${id}/symbols/${symbol}`),
  delete: (id) => api.delete(`/watchlist/${id}`)
}

export const portfolioAPI = {
  getAll: () => api.get('/portfolio'),
  create: (data) => api.post('/portfolio', data),
  addTransaction: (id, data) => api.post(`/portfolio/${id}/transaction`, data),
  delete: (id) => api.delete(`/portfolio/${id}`)
}

export const predictionAPI = {
  predict: (data) => api.post('/predict', data),
  history: (symbol) => api.get(`/predict/history/${symbol}`)
}

export const subscriptionAPI = {
  getPlans: () => api.get('/subscription/plans'),
  upgrade: (plan) => api.post('/subscription/upgrade', { plan }),
  checkout: (plan) => api.post('/subscription/checkout', { plan }),
  portal: () => api.post('/subscription/portal'),
  getStatus: () => api.get('/subscription/status')
}

export const csrfAPI = {
  getToken: () => api.get('/csrf-token')
}

export const adminAPI = {
  getStats: () => api.get('/admin/stats'),
  getUsers: (params) => api.get('/admin/users', { params }),
  updateUser: (id, data) => api.patch(`/admin/users/${id}`, data),
  getMarketConfig: () => api.get('/admin/market-config'),
  upsertMarketConfig: (data) => api.post('/admin/market-config', data),
  // DB Manager
  getDbStatus: () => api.get('/admin/db/status'),
  getDbActivity: (params) => api.get('/admin/db/activity', { params }),
  dbResetPassword: (data) => api.post('/admin/db/reset-password', data),
  dbUnlockAccount: (data) => api.post('/admin/db/unlock', data)
}

export default api

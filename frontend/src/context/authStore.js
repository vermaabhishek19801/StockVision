import { create } from 'zustand'
import api from '../services/api'

// L-4: Access token stored ONLY in memory (never localStorage).
// On page reload the HttpOnly refresh cookie silently re-issues a new access token.
// This prevents XSS token theft since localStorage is readable by any JS on the page.

const useAuthStore = create((set, get) => ({
  user: null,
  accessToken: null,       // memory only — not persisted
  isLoading: true,
  isAuthenticated: false,

  setAuth: (user, accessToken) => {
    // L-4: set in memory + axios header only, NOT localStorage
    if (accessToken) api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    set({ user, accessToken, isAuthenticated: !!user, isLoading: false });
  },

  logout: async () => {
    try { await api.post('/auth/logout') } catch {}
    delete api.defaults.headers.common['Authorization'];
    set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
  },

  refreshToken: async () => {
    try {
      const res = await api.post('/auth/refresh');
      const { accessToken } = res.data;
      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
      set({ accessToken });
      return accessToken;
    } catch {
      get().logout();
      return null;
    }
  },

  // Called once on app mount — uses the HttpOnly cookie to silently restore session
  init: async () => {
    try {
      // Try to get a fresh access token using the refresh cookie
      const refreshRes = await api.post('/auth/refresh');
      const { accessToken } = refreshRes.data;
      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
      const userRes = await api.get('/users/me');
      set({ user: userRes.data.user, accessToken, isAuthenticated: true, isLoading: false });
    } catch {
      // No valid session — user must log in
      delete api.defaults.headers.common['Authorization'];
      set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
    }
  },

  updateUser: (updates) => set(state => ({ user: { ...state.user, ...updates } }))
}));

export default useAuthStore;

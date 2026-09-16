/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: { 50: '#eff6ff', 100: '#dbeafe', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 900: '#1e3a8a' },
        success: '#10b981',
        danger: '#ef4444',
        warning: '#f59e0b',
        surface: { DEFAULT: '#1e2030', card: '#252840', border: '#2d3154' }
      },
      fontFamily: { sans: ['-apple-system', 'Segoe UI', 'system-ui', 'sans-serif'] },
      animation: { pulse: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite', 'spin-slow': 'spin 3s linear infinite' }
    }
  },
  plugins: []
}

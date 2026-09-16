# StockVision 📈

**AI-Powered Live Stock Analysis Platform** — NSE · BSE · NYSE · NASDAQ · LSE · Global Markets

---

## 🚀 Features

### For Users
- 📊 **Live Stock Data** — Real-time quotes via WebSocket (15s refresh), NSE/BSE/international
- 📈 **Interactive Charts** — Candlestick charts with TradingView Lightweight Charts
- 🤖 **AI Predictions** — IBM WatsonX AI (Granite model) + OpenAI fallback + rule-based engine
- 🎯 **Technical Analysis** — RSI, MACD, Bollinger Bands, SMA/EMA, Support/Resistance
- 📉 **Fundamental Analysis** — Revenue, P/E, ROE, ROA, Debt/Equity, and more
- 📰 **Stock News** — Latest news per symbol
- 📋 **Watchlists** — Multiple lists, live quote refresh
- 💼 **Portfolio Tracker** — Buy/sell trades, real-time P&L, allocation pie chart
- 🔍 **Screener** — Filter by exchange, sector, P/E, market cap — like Screener.in
- 💳 **Subscription Plans** — Free / Basic / Pro / Enterprise tiers via Stripe

### For Admins
- 👥 **User Management** — View, edit roles, plans, suspend/activate accounts
- 📊 **Platform Stats** — Total users, MRR, today logins, AI predictions count
- ⚙️ **Market Config** — Configure NSE/BSE/custom exchange data providers
- 🔑 **Role-Based Access** — user / admin / superadmin hierarchy

---

## 🏗 Architecture

```
StockVision/
├── backend/               # Node.js + Express API
│   ├── src/
│   │   ├── config/       # MongoDB, Redis
│   │   ├── controllers/  # Auth, Stock, Admin, Prediction, User
│   │   ├── middleware/   # JWT auth, validation, rate limiting
│   │   ├── models/       # User, Watchlist, Portfolio, Prediction, MarketConfig
│   │   ├── routes/       # All API routes
│   │   ├── services/     # Stock data, Socket.IO, WatsonX/OpenAI predictions
│   │   └── utils/        # Logger (Winston)
│   └── package.json
│
├── frontend/              # React 18 + Vite + TailwindCSS
│   ├── src/
│   │   ├── components/   # Layout, SearchBar, CandlestickChart, MarketTicker
│   │   ├── context/      # Zustand auth store
│   │   ├── hooks/        # useDebounce
│   │   ├── pages/        # Dashboard, StockDetail, Watchlist, Portfolio, Screener,
│   │   │                 # Predictions, Subscription, Admin pages
│   │   └── services/     # Axios API client, Socket.IO client
│   └── package.json
│
└── docker-compose.yml     # Full stack deployment
```

---

## 🔧 Quick Start

### Prerequisites
- Node.js 20+
- MongoDB (local or Atlas)
- Redis (optional — gracefully degraded without it)

### 1. Clone & Setup

```bash
cd StockVision
cp backend/.env.example backend/.env
# Edit backend/.env with your API keys
```

### 2. Backend

```bash
cd backend
npm install
npm run dev
# Server starts at http://localhost:5000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# App starts at http://localhost:5173
```

### 4. Docker (full stack)

```bash
docker-compose up -d
# Frontend: http://localhost:80
# Backend: http://localhost:5000
```

---

## 🔑 API Keys Required

| Service | Purpose | Free Tier |
|---------|---------|-----------|
| **Yahoo Finance** | Primary stock data (built-in via `yahoo-finance2`) | ✅ No key needed |
| **Alpha Vantage** | Backup data provider | ✅ 500 calls/day free |
| **IBM WatsonX** | AI predictions (primary LLM) | Paid |
| **OpenAI** | AI predictions (fallback) | Paid |
| **Stripe** | Payment processing | Test mode free |

---

## 🛡 Security Features

- **JWT + HttpOnly Refresh Token cookies** — secure session management
- **bcrypt password hashing** (12 rounds)
- **Account lockout** after 5 failed login attempts (2h lock)
- **Helmet.js** — HTTP security headers
- **CORS** — strict origin whitelisting
- **Rate Limiting** — 200 req/15min global, 20 req/15min on auth endpoints
- **MongoDB Sanitization** — prevent NoSQL injection
- **HPP** — HTTP Parameter Pollution protection
- **Input Validation** — express-validator on all inputs
- **XSS-clean** — sanitize user input
- **API Key auth** — for Enterprise plan programmatic access

---

## 📡 Supported Markets

| Exchange | Symbols | Data Source |
|----------|---------|-------------|
| NSE | All NSE stocks | nseindia.com API + Yahoo |
| BSE | All BSE stocks | bseindia.com API + Yahoo |
| NYSE/NASDAQ | All US stocks | Yahoo Finance |
| LSE | London stocks | Yahoo Finance |
| Crypto | BTC, ETH, etc. | Yahoo Finance |
| Indices | NIFTY, SENSEX, S&P, Dow, FTSE, Nikkei | Yahoo Finance |
| Mutual Funds | All Yahoo-listed MFs | Yahoo Finance |

---

## 💳 Subscription Plans

| Plan | Price | Features |
|------|-------|---------|
| **Free** | ₹0/mo | 10 watchlist, 1 portfolio, delayed data |
| **Basic** | ₹299/mo | 50 watchlist, 3 portfolios, real-time data, charts |
| **Pro** | ₹999/mo | 200 watchlist, 10 portfolios, AI predictions, export |
| **Enterprise** | ₹4999/mo | Unlimited, API access, priority support |

---

## 🤖 AI Prediction Engine

1. **IBM WatsonX (Primary)** — `ibm/granite-13b-chat-v2` model
2. **OpenAI (Fallback)** — `gpt-4o-mini`
3. **Rule-Based Engine** — Always available, no API key needed

Predictions include: direction (bullish/bearish/neutral), target price range, confidence %, recommendation (strong buy → strong sell), key factors, support/resistance levels.

> ⚠️ Predictions are for informational purposes only and should not be considered financial advice.

---

## 🏛 Admin Panel

Access: Register with `ADMIN_REGISTRATION_SECRET` env variable, then login with admin credentials.

Features mirror **Screener.in** and **Moneycontrol** style:
- Full user management with plan/role control
- Platform revenue analytics
- Market data provider configuration (NSE/BSE URL overrides)
- Real-time statistics

---

*Built with ❤️ using IBM WatsonX AI*

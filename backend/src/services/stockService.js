const axios = require('axios');
const yahooFinance = require('../config/yahooFinance');
const { setCache, getCache } = require('../config/redis');
const MarketConfig = require('../models/MarketConfig');
const logger = require('../utils/logger');

// Fetch quote from Yahoo Finance (universal)
const fetchYahooQuote = async (symbol) => {
  try {
    const quote = await yahooFinance.quote(symbol);
    return {
      symbol: quote.symbol,
      name: quote.longName || quote.shortName,
      price: quote.regularMarketPrice,
      change: quote.regularMarketChange,
      changePercent: quote.regularMarketChangePercent,
      open: quote.regularMarketOpen,
      high: quote.regularMarketDayHigh,
      low: quote.regularMarketDayLow,
      close: quote.regularMarketPreviousClose,
      volume: quote.regularMarketVolume,
      marketCap: quote.marketCap,
      pe: quote.trailingPE,
      eps: quote.epsTrailingTwelveMonths,
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
      avgVolume: quote.averageDailyVolume3Month,
      currency: quote.currency,
      exchange: quote.fullExchangeName,
      sector: quote.sector,
      industry: quote.industry,
      timestamp: new Date(quote.regularMarketTime * 1000),
      marketState: quote.marketState
    };
  } catch (err) {
    logger.error(`Yahoo quote error for ${symbol}:`, err.message);
    return null;
  }
};

// Fetch historical data
const fetchHistory = async (symbol, period1, period2, interval = '1d') => {
  try {
    const result = await yahooFinance.historical(symbol, { period1, period2, interval });
    return result.map(d => ({
      date: d.date,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: d.volume,
      adjClose: d.adjClose
    }));
  } catch (err) {
    logger.error(`History error for ${symbol}:`, err.message);
    return [];
  }
};

// Search symbols
const searchSymbols = async (query) => {
  try {
    const result = await yahooFinance.search(query, { quotesCount: 15, newsCount: 0 });
    return (result.quotes || []).map(q => ({
      symbol: q.symbol,
      name: q.shortname || q.longname,
      exchange: q.exchange,
      type: q.quoteType,
      score: q.score
    }));
  } catch (err) {
    logger.error(`Search error for ${query}:`, err.message);
    return [];
  }
};

// NSE specific fetch
const fetchNSEData = async (symbol) => {
  try {
    const cached = await getCache(`nse:${symbol}`);
    if (cached) return cached;

    const config = await MarketConfig.findOne({ key: 'NSE', isActive: true });
    const baseUrl = config?.baseUrl || 'https://www.nseindia.com/api';

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
      'Referer': 'https://www.nseindia.com/',
      ...((config?.headers) || {})
    };

    const response = await axios.get(`${baseUrl}/quote-equity?symbol=${encodeURIComponent(symbol)}`, {
      headers,
      timeout: 8000
    });

    const data = response.data;
    const result = {
      symbol,
      exchange: 'NSE',
      price: data.priceInfo?.lastPrice,
      change: data.priceInfo?.change,
      changePercent: data.priceInfo?.pChange,
      open: data.priceInfo?.open,
      high: data.priceInfo?.intraDayHighLow?.max,
      low: data.priceInfo?.intraDayHighLow?.min,
      close: data.priceInfo?.previousClose,
      volume: data.preOpenMarket?.totalTradedVolume,
      fiftyTwoWeekHigh: data.priceInfo?.weekHighLow?.max,
      fiftyTwoWeekLow: data.priceInfo?.weekHighLow?.min,
      isin: data.info?.isin,
      industry: data.metadata?.industry,
      sector: data.metadata?.sector,
      source: 'NSE'
    };

    await setCache(`nse:${symbol}`, result, 30);
    return result;
  } catch (err) {
    logger.error(`NSE fetch error for ${symbol}:`, err.message);
    // Fallback to Yahoo Finance
    return await fetchYahooQuote(`${symbol}.NS`);
  }
};

// BSE specific fetch
const fetchBSEData = async (scripCode) => {
  try {
    const cached = await getCache(`bse:${scripCode}`);
    if (cached) return cached;

    const config = await MarketConfig.findOne({ key: 'BSE', isActive: true });
    const baseUrl = config?.baseUrl || 'https://api.bseindia.com/BseIndiaAPI/api';

    const response = await axios.get(`${baseUrl}/StockReachGraph/w?scripcode=${scripCode}&flag=0&fromdate=&todate=&seriesid=`, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.bseindia.com/' },
      timeout: 8000
    });

    const d = response.data;
    const result = {
      scripCode,
      exchange: 'BSE',
      price: parseFloat(d.CurrRate),
      change: parseFloat(d.Chg),
      changePercent: parseFloat(d.PctChg),
      source: 'BSE',
      ...d
    };

    await setCache(`bse:${scripCode}`, result, 30);
    return result;
  } catch (err) {
    logger.error(`BSE fetch error for ${scripCode}:`, err.message);
    return null;
  }
};

// Alpha Vantage fallback
const fetchAlphaVantage = async (symbol, function_name = 'GLOBAL_QUOTE') => {
  try {
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
    if (!apiKey || apiKey === 'your_alpha_vantage_key') return null;
    const response = await axios.get(`https://www.alphavantage.co/query`, {
      params: { function: function_name, symbol, apikey: apiKey },
      timeout: 10000
    });
    return response.data;
  } catch (err) {
    logger.error(`Alpha Vantage error:`, err.message);
    return null;
  }
};

// Get market indices
const getIndices = async () => {
  const cached = await getCache('market:indices');
  if (cached) return cached;

  const indiceSymbols = [
    { symbol: '^NSEI', name: 'NIFTY 50', exchange: 'NSE' },
    { symbol: '^BSESN', name: 'SENSEX', exchange: 'BSE' },
    { symbol: '^DJI', name: 'Dow Jones', exchange: 'NYSE' },
    { symbol: '^GSPC', name: 'S&P 500', exchange: 'NYSE' },
    { symbol: '^IXIC', name: 'NASDAQ', exchange: 'NASDAQ' },
    { symbol: '^FTSE', name: 'FTSE 100', exchange: 'LSE' },
    { symbol: '^N225', name: 'Nikkei 225', exchange: 'TSE' },
    { symbol: '^HSI', name: 'Hang Seng', exchange: 'HKEX' },
  ];

  const results = await Promise.allSettled(
    indiceSymbols.map(async (idx) => {
      const quote = await fetchYahooQuote(idx.symbol);
      return quote ? { ...idx, ...quote } : { ...idx, error: 'unavailable' };
    })
  );

  const indices = results.map(r => r.status === 'fulfilled' ? r.value : null).filter(Boolean);
  await setCache('market:indices', indices, 60);
  return indices;
};

// Calculate technical indicators
const calculateTechnicalIndicators = (prices) => {
  if (!prices || prices.length < 20) return {};
  const closes = prices.map(p => p.close);

  // Simple Moving Averages
  const sma = (data, period) => {
    if (data.length < period) return null;
    return data.slice(-period).reduce((s, v) => s + v, 0) / period;
  };

  // Exponential Moving Average
  const ema = (data, period) => {
    if (data.length < period) return null;
    const k = 2 / (period + 1);
    let emaVal = data.slice(0, period).reduce((s, v) => s + v, 0) / period;
    for (let i = period; i < data.length; i++) {
      emaVal = data[i] * k + emaVal * (1 - k);
    }
    return emaVal;
  };

  // RSI
  const rsi = (data, period = 14) => {
    if (data.length < period + 1) return null;
    const changes = data.slice(1).map((v, i) => v - data[i]);
    const recent = changes.slice(-period);
    const gains = recent.filter(c => c > 0).reduce((s, v) => s + v, 0) / period;
    const losses = Math.abs(recent.filter(c => c < 0).reduce((s, v) => s + v, 0)) / period;
    if (losses === 0) return 100;
    const rs = gains / losses;
    return 100 - 100 / (1 + rs);
  };

  // Bollinger Bands
  const bollingerBands = (data, period = 20, stdDev = 2) => {
    if (data.length < period) return null;
    const slice = data.slice(-period);
    const mean = slice.reduce((s, v) => s + v, 0) / period;
    const variance = slice.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / period;
    const std = Math.sqrt(variance);
    return { upper: mean + stdDev * std, middle: mean, lower: mean - stdDev * std };
  };

  // MACD
  const macd = (data) => {
    const ema12 = ema(data, 12);
    const ema26 = ema(data, 26);
    if (!ema12 || !ema26) return null;
    const macdLine = ema12 - ema26;
    return { macd: macdLine, signal: ema(data.slice(-9), 9) };
  };

  const lastPrice = closes[closes.length - 1];
  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const sma200 = sma(closes, 200);

  return {
    sma20, sma50, sma200,
    ema12: ema(closes, 12),
    ema26: ema(closes, 26),
    rsi: rsi(closes),
    bollingerBands: bollingerBands(closes),
    macd: macd(closes),
    trend: lastPrice > (sma50 || lastPrice) ? 'bullish' : 'bearish',
    priceVsSMA20: sma20 ? ((lastPrice - sma20) / sma20 * 100).toFixed(2) : null,
    priceVsSMA50: sma50 ? ((lastPrice - sma50) / sma50 * 100).toFixed(2) : null,
    signal: (() => {
      const rsiVal = rsi(closes);
      if (rsiVal < 30) return 'oversold';
      if (rsiVal > 70) return 'overbought';
      return 'neutral';
    })()
  };
};

module.exports = { fetchYahooQuote, fetchHistory, searchSymbols, fetchNSEData, fetchBSEData, fetchAlphaVantage, getIndices, calculateTechnicalIndicators };

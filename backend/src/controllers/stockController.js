const stockService = require('../services/stockService');
const yahooFinance = require('../config/yahooFinance');
const { setCache, getCache } = require('../config/redis');
const logger = require('../utils/logger');
const { asyncHandler, internalError, isValidSymbol, VALID_INTERVALS } = require('../utils/helpers');

// GET /api/stocks/search?q=
exports.search = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q || q.length < 2 || q.length > 100) return res.json({ results: [] });
  // Sanitise: only pass safe characters to external API
  const safeQ = q.replace(/[^\w\s.\-^]/g, '');

  const cacheKey = `search:${safeQ.toLowerCase()}`;
  const cached = await getCache(cacheKey);
  if (cached) return res.json({ results: cached });

  const results = await stockService.searchSymbols(safeQ);
  await setCache(cacheKey, results, 300);
  res.json({ results });
});

// GET /api/stocks/quote/:symbol
exports.getQuote = asyncHandler(async (req, res) => {
  const symbol = String(req.params.symbol || '').toUpperCase();
  if (!isValidSymbol(symbol)) return res.status(400).json({ error: 'Invalid symbol format' });

  const exchange = ['NSE', 'BSE', 'NYSE', 'NASDAQ', 'LSE'].includes(req.query.exchange)
    ? req.query.exchange : null;

  const cacheKey = `quote:${symbol}:${exchange || 'auto'}`;
  const cached = await getCache(cacheKey);
  if (cached) return res.json({ quote: cached, cached: true });

  let quote;
  if (exchange === 'NSE') quote = await stockService.fetchNSEData(symbol);
  else if (exchange === 'BSE') quote = await stockService.fetchBSEData(symbol);
  else quote = await stockService.fetchYahooQuote(symbol);

  if (!quote) return res.status(404).json({ error: 'Symbol not found or data unavailable' });
  await setCache(cacheKey, quote, 30);
  res.json({ quote });
});

// GET /api/stocks/history/:symbol
exports.getHistory = asyncHandler(async (req, res) => {
  const symbol = String(req.params.symbol || '').toUpperCase();
  if (!isValidSymbol(symbol)) return res.status(400).json({ error: 'Invalid symbol format' });

  const interval = VALID_INTERVALS.has(req.query.interval) ? req.query.interval : '1d';
  const fromDate = req.query.period1 || new Date(Date.now() - 365 * 864e5).toISOString().split('T')[0];
  const toDate   = req.query.period2 || new Date().toISOString().split('T')[0];
  // Validate dates are actual date strings
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
  }

  const cacheKey = `history:${symbol}:${fromDate}:${toDate}:${interval}`;
  const cached = await getCache(cacheKey);
  if (cached) return res.json({ history: cached, cached: true });

  const history = await stockService.fetchHistory(symbol, fromDate, toDate, interval);
  if (!history.length) return res.status(404).json({ error: 'No historical data found' });

  await setCache(cacheKey, history, interval === '1d' ? 3600 : 300);
  res.json({ history });
});

// GET /api/stocks/technicals/:symbol
exports.getTechnicals = asyncHandler(async (req, res) => {
  const symbol = String(req.params.symbol || '').toUpperCase();
  if (!isValidSymbol(symbol)) return res.status(400).json({ error: 'Invalid symbol format' });

  const cacheKey = `technicals:${symbol}`;
  const cached = await getCache(cacheKey);
  if (cached) return res.json({ technicals: cached, cached: true });

  const fromDate = new Date(Date.now() - 300 * 864e5).toISOString().split('T')[0];
  const history  = await stockService.fetchHistory(symbol, fromDate, new Date().toISOString().split('T')[0]);
  const technicals = stockService.calculateTechnicalIndicators(history);
  await setCache(cacheKey, technicals, 300);
  res.json({ technicals, dataPoints: history.length });
});

// GET /api/stocks/fundamentals/:symbol
exports.getFundamentals = asyncHandler(async (req, res) => {
  const symbol = String(req.params.symbol || '').toUpperCase();
  if (!isValidSymbol(symbol)) return res.status(400).json({ error: 'Invalid symbol format' });

  const cacheKey = `fundamentals:${symbol}`;
  const cached = await getCache(cacheKey);
  if (cached) return res.json({ fundamentals: cached, cached: true });

  const [quoteSummary] = await Promise.allSettled([
    yahooFinance.quoteSummary(symbol, {
      modules: ['financialData', 'defaultKeyStatistics', 'assetProfile', 'incomeStatementHistory', 'balanceSheetHistory']
    })
  ]);
  if (quoteSummary.status === 'rejected') return res.status(404).json({ error: 'Fundamentals data not available' });

  const data = quoteSummary.value;
  const fundamentals = {
    profile: data.assetProfile ? {
      industry: data.assetProfile.industry,
      sector: data.assetProfile.sector,
      description: data.assetProfile.longBusinessSummary,
      country: data.assetProfile.country,
      website: data.assetProfile.website,
      employees: data.assetProfile.fullTimeEmployees
    } : null,
    financials: data.financialData ? {
      revenue: data.financialData.totalRevenue?.raw,
      grossProfit: data.financialData.grossProfits?.raw,
      netIncome: data.financialData.netIncomeToCommon?.raw,
      operatingCashFlow: data.financialData.operatingCashflow?.raw,
      debtToEquity: data.financialData.debtToEquity?.raw,
      returnOnEquity: data.financialData.returnOnEquity?.raw,
      returnOnAssets: data.financialData.returnOnAssets?.raw,
      profitMargin: data.financialData.profitMargins?.raw,
      currentRatio: data.financialData.currentRatio?.raw,
      quickRatio: data.financialData.quickRatio?.raw
    } : null,
    keyStats: data.defaultKeyStatistics ? {
      enterpriseValue: data.defaultKeyStatistics.enterpriseValue?.raw,
      forwardPE: data.defaultKeyStatistics.forwardPE?.raw,
      pegRatio: data.defaultKeyStatistics.pegRatio?.raw,
      priceToBook: data.defaultKeyStatistics.priceToBook?.raw,
      beta: data.defaultKeyStatistics.beta?.raw,
      bookValue: data.defaultKeyStatistics.bookValue?.raw,
      sharesOutstanding: data.defaultKeyStatistics.sharesOutstanding?.raw
    } : null
  };
  await setCache(cacheKey, fundamentals, 3600 * 6);
  res.json({ fundamentals });
});

// GET /api/stocks/screener
exports.screener = asyncHandler(async (req, res) => {
  const VALID_EXCHANGES = { NSE: 'NSI', BSE: 'BSE', NYSE: 'NYQ', NASDAQ: 'NMS', LSE: 'LSE' };
  const exchange = VALID_EXCHANGES[String(req.query.exchange || 'NSE').toUpperCase()] || 'NSI';
  const VALID_SORT = new Set(['marketCap', 'regularMarketChangePercent', 'regularMarketVolume', 'trailingPE']);
  const sortBy = VALID_SORT.has(req.query.sortBy) ? req.query.sortBy : 'marketCap';
  const order  = req.query.order === 'asc' ? 'ASC' : 'DESC';
  // L-3: Cap limit to prevent database dump
  const limit  = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);

  const minPE = parseFloat(req.query.minPE);
  const maxPE = parseFloat(req.query.maxPE);
  const sector = typeof req.query.sector === 'string' ? req.query.sector.substring(0, 50) : null;

  const screeningQuery = {
    operator: 'AND',
    operands: [{ operator: 'eq', operands: ['exchange', exchange] }]
  };
  if (sector) screeningQuery.operands.push({ operator: 'eq', operands: ['sector', sector] });
  if (!isNaN(minPE)) screeningQuery.operands.push({ operator: 'gte', operands: ['trailingpe', minPE] });
  if (!isNaN(maxPE)) screeningQuery.operands.push({ operator: 'lte', operands: ['trailingpe', maxPE] });

  const result = await yahooFinance.screener({ query: screeningQuery, sortField: sortBy, sortType: order, offset: 0, size: limit }).catch(() => null);
  if (!result) return res.json({ stocks: [], total: 0 });

  const stocks = (result.quotes || []).map(q => ({
    symbol: q.symbol, name: q.shortName, price: q.regularMarketPrice,
    change: q.regularMarketChange, changePercent: q.regularMarketChangePercent,
    volume: q.regularMarketVolume, marketCap: q.marketCap,
    pe: q.trailingPE, eps: q.epsTrailingTwelveMonths, sector: q.sector
  }));
  res.json({ stocks, total: result.total });
});

// GET /api/stocks/news/:symbol
exports.getNews = asyncHandler(async (req, res) => {
  const symbol = String(req.params.symbol || '').toUpperCase();
  if (!isValidSymbol(symbol)) return res.status(400).json({ error: 'Invalid symbol format' });

  const cacheKey = `news:${symbol}`;
  const cached = await getCache(cacheKey);
  if (cached) return res.json({ news: cached });

  const result = await yahooFinance.search(symbol, { quotesCount: 0, newsCount: 10 });
  const news = (result.news || []).map(n => ({
    title: n.title,
    publisher: n.publisher,
    link: n.link,
    providerPublishTime: n.providerPublishTime,
    thumbnail: n.thumbnail?.resolutions?.[0]?.url
  }));
  await setCache(cacheKey, news, 600);
  res.json({ news });
});

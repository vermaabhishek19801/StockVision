let WatsonXAI = null;
let OpenAI = null;
try { WatsonXAI = require('@ibm-cloud/watsonx-ai').WatsonXAI; } catch {}
try { OpenAI = require('openai'); } catch {}
const Prediction = require('../models/Prediction');
const stockService = require('./stockService');
const { setCache, getCache } = require('../config/redis');
const logger = require('../utils/logger');

let watsonxClient = null;
let openaiClient = null;

// Initialize WatsonX client
const getWatsonXClient = () => {
  if (!watsonxClient && WatsonXAI && process.env.WATSONX_API_KEY && process.env.WATSONX_API_KEY !== 'your_watsonx_api_key') {
    try {
      watsonxClient = WatsonXAI.newInstance({
        version: '2024-05-31',
        serviceUrl: process.env.WATSONX_URL || 'https://us-south.ml.cloud.ibm.com',
        authenticator: { authenticate: (r) => { r.headers.Authorization = `Bearer ${process.env.WATSONX_API_KEY}`; } }
      });
    } catch (err) {
      logger.error('WatsonX init error:', err.message);
    }
  }
  return watsonxClient;
};

// Initialize OpenAI client (fallback)
const getOpenAIClient = () => {
  if (!openaiClient && OpenAI && process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key') {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
};

// ── M-7: Sanitise user-supplied inputs before embedding in LLM prompt ────────
const sanitiseForPrompt = (value, maxLen = 60) => {
  if (value == null) return 'N/A';
  return String(value)
    .replace(/[`'"\\]/g, '')          // strip quotes/backticks/backslashes
    .replace(/\n|\r/g, ' ')           // flatten newlines
    .replace(/<[^>]*>/g, '')          // strip HTML/XML tags
    .replace(/\{|\}/g, '')            // strip braces (prevent JSON injection)
    .replace(/ignore\s+previous\s+instructions?/gi, '[REDACTED]')
    .replace(/system\s*:/gi, '[REDACTED]')
    .replace(/you\s+are\s+now/gi, '[REDACTED]')
    .trim()
    .substring(0, maxLen);
};

// Build analysis prompt
const buildPredictionPrompt = (symbol, quote, history, technicals, timeframe) => {
  const safeSymbol = sanitiseForPrompt(symbol, 20);
  const recentPrices = history.slice(-30).map(h => h.close.toFixed(2)).join(', ');
  const priceChange30d = history.length >= 30
    ? (((history[history.length - 1]?.close - history[history.length - 30]?.close) / history[history.length - 30]?.close) * 100).toFixed(2)
    : 'N/A';

  return `You are an expert financial analyst and quantitative trader with deep knowledge of Indian and global stock markets.

STOCK ANALYSIS REQUEST:
Symbol: ${safeSymbol}
Current Price: ${sanitiseForPrompt(quote?.price)} ${sanitiseForPrompt(quote?.currency || 'INR', 10)}
Day Change: ${sanitiseForPrompt(quote?.change)} (${sanitiseForPrompt((quote?.changePercent || 0).toFixed(2), 10)}%)
52W High/Low: ${sanitiseForPrompt(quote?.fiftyTwoWeekHigh)} / ${sanitiseForPrompt(quote?.fiftyTwoWeekLow)}
Volume: ${sanitiseForPrompt(quote?.volume)}
Market Cap: ${sanitiseForPrompt(quote?.marketCap)}
P/E Ratio: ${sanitiseForPrompt(quote?.pe)}
Sector: ${sanitiseForPrompt(quote?.sector, 40)}

TECHNICAL INDICATORS:
RSI (14): ${technicals?.rsi?.toFixed(2) || 'N/A'}
SMA 20: ${technicals?.sma20?.toFixed(2) || 'N/A'}
SMA 50: ${technicals?.sma50?.toFixed(2) || 'N/A'}
SMA 200: ${technicals?.sma200?.toFixed(2) || 'N/A'}
MACD: ${technicals?.macd?.macd?.toFixed(4) || 'N/A'}
Bollinger Upper/Lower: ${technicals?.bollingerBands?.upper?.toFixed(2) || 'N/A'} / ${technicals?.bollingerBands?.lower?.toFixed(2) || 'N/A'}
Signal: ${technicals?.signal || 'neutral'}
Trend: ${technicals?.trend || 'N/A'}
Price vs SMA20: ${technicals?.priceVsSMA20 || 'N/A'}%
Price vs SMA50: ${technicals?.priceVsSMA50 || 'N/A'}%

RECENT PRICE HISTORY (last 30 days): ${recentPrices}
30-Day Price Change: ${priceChange30d}%

PREDICTION TIMEFRAME: ${timeframe}

Based on this comprehensive analysis, provide a detailed prediction in the following JSON format ONLY (no other text):
{
  "direction": "bullish|bearish|neutral",
  "targetPrice": <number>,
  "targetPriceLow": <number>,
  "targetPriceHigh": <number>,
  "confidence": <0-100>,
  "rationale": "<detailed 3-4 sentence analysis>",
  "keyFactors": ["<factor 1>", "<factor 2>", "<factor 3>"],
  "riskLevel": "low|medium|high",
  "recommendation": "strong_buy|buy|hold|sell|strong_sell",
  "supportLevels": [<price1>, <price2>],
  "resistanceLevels": [<price1>, <price2>]
}`;
};

// Predict using WatsonX
const predictWithWatsonX = async (prompt, symbol) => {
  const client = getWatsonXClient();
  if (!client) return null;

  try {
    const response = await client.generateText({
      modelId: 'ibm/granite-13b-chat-v2',
      projectId: process.env.WATSONX_PROJECT_ID,
      input: prompt,
      parameters: {
        max_new_tokens: 600,
        temperature: 0.3,
        top_p: 0.9,
        repetition_penalty: 1.1
      }
    });

    const text = response.result?.results?.[0]?.generated_text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    logger.error(`WatsonX prediction error for ${symbol}:`, err.message);
    return null;
  }
};

// Predict using OpenAI (fallback)
const predictWithOpenAI = async (prompt, symbol) => {
  const client = getOpenAIClient();
  if (!client) return null;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a financial analyst. Respond ONLY with valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 600,
      response_format: { type: 'json_object' }
    });

    const text = response.choices[0]?.message?.content || '{}';
    return JSON.parse(text);
  } catch (err) {
    logger.error(`OpenAI prediction error for ${symbol}:`, err.message);
    return null;
  }
};

// Rule-based fallback prediction (no LLM required)
const predictWithRules = (quote, technicals) => {
  const rsi = technicals?.rsi || 50;
  const trend = technicals?.trend;
  const signal = technicals?.signal;
  const price = quote?.price || 0;

  let direction = 'neutral';
  let recommendation = 'hold';
  let confidence = 50;
  let riskLevel = 'medium';

  if (rsi < 30 && trend === 'bullish') { direction = 'bullish'; recommendation = 'buy'; confidence = 65; }
  else if (rsi < 25) { direction = 'bullish'; recommendation = 'strong_buy'; confidence = 70; riskLevel = 'medium'; }
  else if (rsi > 70 && trend === 'bearish') { direction = 'bearish'; recommendation = 'sell'; confidence = 60; }
  else if (rsi > 80) { direction = 'bearish'; recommendation = 'strong_sell'; confidence = 68; }
  else if (signal === 'oversold') { direction = 'bullish'; recommendation = 'buy'; confidence = 60; }
  else if (signal === 'overbought') { direction = 'bearish'; recommendation = 'sell'; confidence = 60; }
  else if (trend === 'bullish') { direction = 'bullish'; recommendation = 'buy'; confidence = 55; }
  else if (trend === 'bearish') { direction = 'bearish'; recommendation = 'sell'; confidence = 55; }

  const volatility = (quote?.fiftyTwoWeekHigh - quote?.fiftyTwoWeekLow) / quote?.fiftyTwoWeekLow || 0;
  if (volatility > 0.5) riskLevel = 'high';
  else if (volatility < 0.2) riskLevel = 'low';

  const targetMultiplier = direction === 'bullish' ? 1.08 : direction === 'bearish' ? 0.93 : 1.02;

  return {
    direction,
    targetPrice: parseFloat((price * targetMultiplier).toFixed(2)),
    targetPriceLow: parseFloat((price * (targetMultiplier - 0.05)).toFixed(2)),
    targetPriceHigh: parseFloat((price * (targetMultiplier + 0.05)).toFixed(2)),
    confidence,
    rationale: `Technical analysis indicates ${direction} momentum. RSI is ${rsi.toFixed(1)} (${signal}), trend is ${trend}. Support and resistance levels derived from moving averages. This is a rule-based analysis; enable AI prediction for enhanced insights.`,
    keyFactors: [
      `RSI at ${rsi.toFixed(1)} — ${signal} territory`,
      `Price trend: ${trend}`,
      `52-week range: ${quote?.fiftyTwoWeekLow} - ${quote?.fiftyTwoWeekHigh}`,
      `SMA50 vs price: ${technicals?.priceVsSMA50 || 'N/A'}%`
    ],
    riskLevel,
    recommendation,
    supportLevels: [technicals?.sma50 || price * 0.95, technicals?.sma200 || price * 0.88].filter(Boolean).map(v => parseFloat(v.toFixed(2))),
    resistanceLevels: [technicals?.bollingerBands?.upper || price * 1.05].filter(Boolean).map(v => parseFloat(v.toFixed(2)))
  };
};

// Main predict function
const predict = async (symbol, exchange, timeframe = '1m', userId = null, forceRefresh = false) => {
  const cacheKey = `prediction:${symbol}:${timeframe}`;

  if (!forceRefresh) {
    const cached = await getCache(cacheKey);
    if (cached) return { ...cached, fromCache: true };

    // Check DB for recent prediction (< 4 hours old)
    const recent = await Prediction.findOne({
      symbol: symbol.toUpperCase(),
      timeframe,
      createdAt: { $gte: new Date(Date.now() - 4 * 60 * 60 * 1000) }
    }).sort('-createdAt');

    if (recent) return { ...recent.toObject(), fromCache: true };
  }

  // Gather data
  const [quote, history] = await Promise.all([
    stockService.fetchYahooQuote(symbol),
    stockService.fetchHistory(symbol, new Date(Date.now() - 300 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], new Date().toISOString().split('T')[0])
  ]);

  const technicals = stockService.calculateTechnicalIndicators(history);
  const prompt = buildPredictionPrompt(symbol, quote, history, technicals, timeframe);

  let predictionData = null;
  let provider = 'internal';

  // Try WatsonX first
  predictionData = await predictWithWatsonX(prompt, symbol);
  if (predictionData) provider = 'watsonx';

  // Fallback to OpenAI
  if (!predictionData) {
    predictionData = await predictWithOpenAI(prompt, symbol);
    if (predictionData) provider = 'openai';
  }

  // Final fallback: rule-based
  if (!predictionData) {
    predictionData = predictWithRules(quote, technicals);
    provider = 'internal';
  }

  // Save to DB
  const prediction = await Prediction.create({
    symbol: symbol.toUpperCase(),
    exchange,
    requestedBy: userId,
    provider,
    timeframe,
    inputData: {
      currentPrice: quote?.price,
      technicalIndicators: technicals,
      fundamentals: { pe: quote?.pe, marketCap: quote?.marketCap }
    },
    prediction: predictionData,
    cachedUntil: new Date(Date.now() + 4 * 60 * 60 * 1000)
  });

  await setCache(cacheKey, prediction.toObject(), 4 * 3600);

  return prediction.toObject();
};

module.exports = { predict };

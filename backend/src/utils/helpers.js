// H-4: Reusable asyncHandler to catch unhandled rejections in any route
const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// H-2: Never leak internal errors — use this in every catch
const internalError = (res, req, err, logger, context) => {
  logger.error({ event: context, requestId: req?.id, message: err?.message, stack: err?.stack });
  return res.status(500).json({ error: 'Internal server error', requestId: req?.id });
};

// H-1: Validate stock symbol format (alphanumeric, dots, hyphens, carets — max 20 chars)
const SYMBOL_RE = /^[A-Z0-9.\-\^]{1,20}$/i;
const isValidSymbol = (s) => typeof s === 'string' && SYMBOL_RE.test(s);

// H-1: Allowed interval values
const VALID_INTERVALS = new Set(['1m', '2m', '5m', '15m', '30m', '60m', '90m', '1h', '1d', '5d', '1wk', '1mo', '3mo']);

module.exports = { asyncHandler, internalError, isValidSymbol, VALID_INTERVALS };

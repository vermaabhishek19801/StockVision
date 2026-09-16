// Singleton yahoo-finance2 v4 instance.
// v4 changed from a pre-built export to a class that must be instantiated.
// All files import this module instead of requiring yahoo-finance2 directly.
const YahooFinanceClass = require('yahoo-finance2').default;

const yahooFinance = new YahooFinanceClass({
  suppressNotices: ['yahooSurvey']
});

module.exports = yahooFinance;

const EXCHANGE_RATES_ENV_KEY = 'COILDFI_EXCHANGE_RATES';

const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'KRW', 'VND', 'IDR']);

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  INR: '₹',
  JPY: '¥',
  CAD: 'C$',
  AUD: 'A$',
  BRL: 'R$',
  CNY: '¥',
  KRW: '₩',
  CHF: 'CHF',
  SEK: 'kr',
  NZD: 'NZ$',
  SGD: 'S$',
  HKD: 'HK$',
  NOK: 'kr',
  DKK: 'kr',
  MXN: 'MX$',
  TWD: 'NT$',
  THB: '฿',
  MYR: 'RM',
  PHP: '₱',
  IDR: 'Rp',
  VND: '₫',
  ZAR: 'R',
  RUB: '₽',
  PLN: 'zł',
  TRY: '₺',
  AED: 'د.إ',
  SAR: '﷼',
  ILS: '₪',
  CZK: 'Kč',
  HUF: 'Ft',
  RON: 'lei',
  BGN: 'лв',
  ISK: 'kr',
  HRK: 'kn',
};

const DEFAULT_EXCHANGE_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  INR: 83.12,
  JPY: 149.5,
  CAD: 1.36,
  AUD: 1.53,
  BRL: 4.97,
  CNY: 7.24,
  KRW: 1325.0,
  CHF: 0.88,
  SEK: 10.45,
  NZD: 1.64,
  SGD: 1.34,
  HKD: 7.82,
  NOK: 10.72,
  DKK: 6.90,
  MXN: 17.15,
  TWD: 32.05,
  THB: 35.80,
  MYR: 4.68,
  PHP: 56.20,
  IDR: 15650.0,
  VND: 24600.0,
  ZAR: 18.75,
  RUB: 92.50,
  PLN: 4.02,
  TRY: 30.45,
  AED: 3.67,
  SAR: 3.75,
  ILS: 3.68,
  CZK: 22.80,
  HUF: 358.0,
  RON: 4.57,
  BGN: 1.80,
  ISK: 138.0,
  HRK: 6.96,
};

const AMBIGUOUS_SYMBOLS: Record<string, string[]> = {
  '¥': ['JPY', 'CNY'],
  kr: ['SEK', 'NOK', 'DKK', 'ISK'],
  'S$': ['SGD'],
  'HK$': ['HKD'],
  'NZ$': ['NZD'],
  'MX$': ['MXN'],
};

function loadExchangeRates(): Record<string, number> {
  try {
    const raw = process.env[EXCHANGE_RATES_ENV_KEY];
    if (raw) {
      const parsed: Record<string, number> = {};
      for (const pair of raw.split(',')) {
        const [code, rate] = pair.trim().split('=');
        if (code && rate && code.length >= 2) {
          parsed[code.toUpperCase()] = parseFloat(rate);
        }
      }
      if (Object.keys(parsed).length > 0) return parsed;
    }
  } catch {
  }
  return { ...DEFAULT_EXCHANGE_RATES };
}

let currentRates: Record<string, number> | null = null;

function getExchangeRates(): Record<string, number> {
  if (!currentRates) {
    currentRates = loadExchangeRates();
  }
  return currentRates;
}

export function reloadExchangeRates(): Record<string, number> {
  currentRates = loadExchangeRates();
  return currentRates;
}

export function formatCurrency(amount: number, currency: string): string {
  const symbol = getCurrencySymbol(currency);
  const decimals = ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2;
  const formatted = Math.abs(amount).toFixed(decimals);
  const sign = amount < 0 ? '-' : '';
  return `${sign}${symbol}${formatted}`;
}

function adjustAmountForCurrency(amount: number, currency: string): number {
  if (ZERO_DECIMAL_CURRENCIES.has(currency)) {
    return Math.round(amount);
  }
  return Math.round(amount * 100) / 100;
}

const SYMBOL_ORDER = Object.entries(CURRENCY_SYMBOLS).sort(
  (a, b) => b[1].length - a[1].length
);

export function parseCurrency(value: string): { amount: number; currency: string } | null {
  const cleaned = value.trim();

  const codeMatch = cleaned.match(/^([A-Z]{3})\s*(\d[\d,.]*)$/);
  if (codeMatch) {
    const currency = codeMatch[1]!;
    const amount = parseFloat(codeMatch[2]!.replace(/,/g, ''));
    if (!isNaN(amount)) return { amount: adjustAmountForCurrency(amount, currency), currency };
  }

  for (const [code, symbol] of SYMBOL_ORDER) {
    if (!cleaned.startsWith(symbol)) continue;
    const ambiguous = AMBIGUOUS_SYMBOLS[symbol];
    if (ambiguous) {
      for (const ambigCode of ambiguous) {
        const rest = cleaned.replace(symbol, '').trim().replace(/,/g, '');
        const amount = parseFloat(rest);
        if (!isNaN(amount)) return { amount: adjustAmountForCurrency(amount, ambigCode), currency: ambigCode };
      }
    }
    const numStr = cleaned.slice(symbol.length).trim().replace(/,/g, '');
    const amount = parseFloat(numStr);
    if (!isNaN(amount)) return { amount: adjustAmountForCurrency(amount, code), currency: code };
  }

  return null;
}

export function convertCurrency(amount: number, from: string, to: string): number {
  if (from === to) return Math.round(amount * 100) / 100;
  const rates = getExchangeRates();
  const fromRate = rates[from];
  const toRate = rates[to];
  if (fromRate === undefined || toRate === undefined) {
    throw new Error(`Unsupported currency: ${fromRate === undefined ? from : to}`);
  }
  const result = (amount / fromRate) * toRate;
  return Math.round(result * 100) / 100;
}

export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? currency;
}

export function getAllCurrencies(): string[] {
  return Object.keys(CURRENCY_SYMBOLS);
}

export function isValidCurrencyCode(code: string): boolean {
  return code in CURRENCY_SYMBOLS;
}

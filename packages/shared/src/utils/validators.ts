export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '123456', '12345678', '123456789',
  'qwerty', 'qwerty123', 'abc123', 'letmein', 'welcome', 'monkey', 'dragon',
  'master', 'admin', 'login', 'passw0rd', 'trustno1', 'iloveyou', 'sunshine',
  'princess', 'football', 'baseball', 'shadow', 'michael', 'superman',
]);

const SEQUENTIAL_PATTERNS = [
  /abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz/i,
  /012|123|234|345|456|567|678|789|890/,
  /qwerty|asdf|zxcv|йцук|фыва/i,
];

const REPEATED_CHAR = /(.)\1{2,}/;

export function isValidPassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (password.length < 8) errors.push('Password must be at least 8 characters');
  if (password.length > 128) errors.push('Password must be less than 128 characters');
  if (!/[A-Z]/.test(password)) errors.push('Password must contain an uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('Password must contain a lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('Password must contain a digit');
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) errors.push('Password must contain a special character');

  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) errors.push('Password is too common');
  if (SEQUENTIAL_PATTERNS.some(p => p.test(password))) errors.push('Password contains sequential characters');
  if (REPEATED_CHAR.test(password)) errors.push('Password contains repeated characters (e.g., "aaa")');

  return { valid: errors.length === 0, errors };
}

export function isValidAmount(amount: unknown): amount is number {
  return typeof amount === 'number' && isFinite(amount) && amount >= 0 && amount < 1_000_000_000;
}

export function isValidCurrency(currency: string): boolean {
  const valid = [
    'USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD', 'BRL', 'CNY', 'KRW',
    'CHF', 'SEK', 'NZD', 'SGD', 'HKD', 'NOK', 'DKK', 'MXN', 'TWD', 'THB',
    'MYR', 'PHP', 'IDR', 'VND', 'ZAR', 'RUB', 'PLN', 'TRY', 'AED', 'SAR',
    'ILS', 'CZK', 'HUF', 'RON', 'BGN', 'ISK', 'HRK', 'BDT',
  ];
  return valid.includes(currency);
}

export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

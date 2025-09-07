/**
 * Currency formatting utilities
 */

export interface CurrencyConfig {
  code: string;
  symbol: string;
  locale: string;
  decimals: number;
}

export const CURRENCY_CONFIGS: Record<string, CurrencyConfig> = {
  INR: {
    code: 'INR',
    symbol: '₹',
    locale: 'en-IN',
    decimals: 2,
  },
  USD: {
    code: 'USD',
    symbol: '$',
    locale: 'en-US',
    decimals: 2,
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    locale: 'de-DE',
    decimals: 2,
  },
  GBP: {
    code: 'GBP',
    symbol: '£',
    locale: 'en-GB',
    decimals: 2,
  },
  CAD: {
    code: 'CAD',
    symbol: 'C$',
    locale: 'en-CA',
    decimals: 2,
  },
  AUD: {
    code: 'AUD',
    symbol: 'A$',
    locale: 'en-AU',
    decimals: 2,
  },
};

/**
 * Format an amount in cents to a currency string
 * @param amountInCents - Amount in cents (e.g., 250000 for ₹2,500.00)
 * @param currencyCode - Currency code (e.g., 'INR', 'USD')
 * @returns Formatted currency string
 */
export function formatCurrency(amountInCents: number, currencyCode: string = 'INR'): string {
  const config = CURRENCY_CONFIGS[currencyCode] || CURRENCY_CONFIGS.INR;
  const amountInUnits = amountInCents / 100;

  try {
    return new Intl.NumberFormat(config.locale, {
      style: 'currency',
      currency: config.code,
      minimumFractionDigits: config.decimals,
      maximumFractionDigits: config.decimals,
    }).format(amountInUnits);
  } catch (error) {
    // Fallback formatting if Intl.NumberFormat fails
    return `${config.symbol}${amountInUnits.toLocaleString(config.locale, {
      minimumFractionDigits: config.decimals,
      maximumFractionDigits: config.decimals,
    })}`;
  }
}

/**
 * Format an amount with just the symbol (compact format)
 * @param amountInCents - Amount in cents
 * @param currencyCode - Currency code
 * @returns Formatted string with symbol
 */
export function formatCurrencyCompact(amountInCents: number, currencyCode: string = 'INR'): string {
  const config = CURRENCY_CONFIGS[currencyCode] || CURRENCY_CONFIGS.INR;
  const amountInUnits = amountInCents / 100;

  if (amountInUnits >= 1000000) {
    return `${config.symbol}${(amountInUnits / 1000000).toFixed(1)}M`;
  } else if (amountInUnits >= 1000) {
    return `${config.symbol}${(amountInUnits / 1000).toFixed(1)}K`;
  } else {
    return `${config.symbol}${amountInUnits.toFixed(config.decimals)}`;
  }
}

/**
 * Get currency symbol for a given currency code
 * @param currencyCode - Currency code
 * @returns Currency symbol
 */
export function getCurrencySymbol(currencyCode: string = 'INR'): string {
  const config = CURRENCY_CONFIGS[currencyCode] || CURRENCY_CONFIGS.INR;
  return config.symbol;
}

/**
 * Parse currency input and convert to cents
 * @param input - User input (e.g., "2500", "2,500.00")
 * @returns Amount in cents
 */
export function parseCurrencyInput(input: string): number {
  // Remove any non-digit and non-decimal characters
  const cleanInput = input.replace(/[^\d.-]/g, '');
  const amount = parseFloat(cleanInput);
  
  if (isNaN(amount)) {
    return 0;
  }
  
  // Convert to cents
  return Math.round(amount * 100);
}

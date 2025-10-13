/**
 * IST (Indian Standard Time) timezone utilities for consistent time handling
 * Application-wide timezone: Asia/Kolkata (UTC+5:30)
 */

export const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Get current time in IST
 */
export function getCurrentISTTime(): Date {
  return new Date();
}

/**
 * Format date for IST display
 */
export function formatISTDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('en-IN', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

/**
 * Format datetime for IST display
 */
export function formatISTDateTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleString('en-IN', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false // 24-hour format
  });
}

/**
 * Format time for IST display
 */
export function formatISTTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleTimeString('en-IN', {
    timeZone: IST_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false // 24-hour format
  });
}

/**
 * Convert UTC date to IST date string (YYYY-MM-DD)
 */
export function utcToISTDateString(utcDate: Date | string): string {
  const dateObj = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
  const istDate = new Date(dateObj.toLocaleString('en-US', { timeZone: IST_TIMEZONE }));
  
  const year = istDate.getFullYear();
  const month = String(istDate.getMonth() + 1).padStart(2, '0');
  const day = String(istDate.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Convert IST date string to UTC Date
 */
export function istDateStringToUTC(istDateString: string): Date {
  // Parse IST date and create UTC date
  const [year, month, day] = istDateString.split('-').map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  return utcDate;
}

/**
 * Get start of day in IST for a given date
 */
export function getISTStartOfDay(date: Date | string): Date {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const istDateString = utcToISTDateString(dateObj);
  return istDateStringToUTC(istDateString);
}

/**
 * Get end of day in IST for a given date
 */
export function getISTEndOfDay(date: Date | string): Date {
  const startOfDay = getISTStartOfDay(date);
  const endOfDay = new Date(startOfDay);
  endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);
  endOfDay.setUTCMilliseconds(endOfDay.getUTCMilliseconds() - 1);
  return endOfDay;
}

/**
 * Check if two dates are on the same IST day
 */
export function isSameISTDay(date1: Date | string, date2: Date | string): boolean {
  const istDate1 = utcToISTDateString(date1);
  const istDate2 = utcToISTDateString(date2);
  return istDate1 === istDate2;
}

/**
 * Get IST date range for database queries
 */
export function getISTDateRange(dateString: string): { start: string; end: string } {
  const startOfDay = getISTStartOfDay(dateString);
  const endOfDay = getISTEndOfDay(dateString);
  
  return {
    start: startOfDay.toISOString(),
    end: endOfDay.toISOString()
  };
}

/**
 * Format currency for Indian market
 */
export function formatINRCurrency(amountCents: number): string {
  const amount = amountCents / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Get current IST date string (YYYY-MM-DD)
 */
export function getCurrentISTDateString(): string {
  return utcToISTDateString(new Date());
}

/**
 * Get current IST datetime string (YYYY-MM-DD HH:MM:SS)
 */
export function getCurrentISTDateTimeString(): string {
  const now = new Date();
  const istDate = formatISTDate(now);
  const istTime = formatISTTime(now);
  return `${istDate} ${istTime}`;
}

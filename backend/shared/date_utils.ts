// Shared date utilities for IST (Asia/Kolkata) timezone normalization
// Ensures consistent date keys across publishers, subscribers, cache, and queries

/**
 * Converts a Date or ISO string to IST date string (YYYY-MM-DD)
 * @param d - Date object or ISO string
 * @returns IST date string in YYYY-MM-DD format
 */
export function toISTDateString(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  
  // Convert to IST (UTC+5:30)
  const istDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  
  const year = istDate.getFullYear();
  const month = String(istDate.getMonth() + 1).padStart(2, '0');
  const day = String(istDate.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Adds/subtracts days to an IST date string
 * @param isoDate - Date string in YYYY-MM-DD format
 * @param days - Number of days to add (positive) or subtract (negative)
 * @returns New IST date string in YYYY-MM-DD format
 */
export function addDaysIST(isoDate: string, days: number): string {
  const date = new Date(isoDate + 'T00:00:00+05:30'); // Parse as IST
  date.setDate(date.getDate() + days);
  return toISTDateString(date);
}

/**
 * Normalizes any date input to IST YYYY-MM-DD format
 * Ensures consistency for cache keys and database queries
 * @param date - Date object, ISO string, or YYYY-MM-DD string
 * @returns Normalized IST date string in YYYY-MM-DD format
 */
export function normalizeDateKey(date: Date | string): string {
  // If already in YYYY-MM-DD format, convert to IST to ensure consistency
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    // Parse as IST midnight
    return toISTDateString(new Date(date + 'T00:00:00+05:30'));
  }
  
  return toISTDateString(date);
}

/**
 * Gets today's date in IST
 * @returns IST date string in YYYY-MM-DD format
 */
export function getTodayIST(): string {
  return toISTDateString(new Date());
}

/**
 * Checks if a date string is today in IST
 * @param date - Date string to check
 * @returns true if the date is today in IST
 */
export function isTodayIST(date: string): boolean {
  return normalizeDateKey(date) === getTodayIST();
}


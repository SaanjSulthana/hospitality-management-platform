/**
 * Date utility functions for consistent IST (Indian Standard Time) handling across the application
 * Application timezone: Asia/Kolkata (UTC+5:30)
 */

const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Convert date input (YYYY-MM-DD) to API format with start of day in IST
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns ISO string with start of day in IST
 */
export const formatDateForAPI = (dateString: string): string => {
  // Add comprehensive null/undefined checks
  if (!dateString || typeof dateString !== 'string') {
    console.error('formatDateForAPI received invalid input:', dateString, 'Type:', typeof dateString);
    return new Date().toISOString();
  }
  
  // Validate date format before splitting
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    console.error('formatDateForAPI received invalid date format:', dateString);
    return new Date().toISOString();
  }
  
  try {
    // Create UTC date directly to avoid timezone conversion issues
    // This ensures the date stays as intended (e.g., 2025-10-14 stays 2025-10-14)
    const [year, month, day] = dateString.split('-').map(Number);
    
    // Validate the parsed numbers
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      console.error('formatDateForAPI failed to parse date components:', { year, month, day });
      return new Date().toISOString();
    }
    
    // Create UTC date at start of day (00:00:00) to avoid timezone shifts
    const utcDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    
    // Validate the resulting date
    if (isNaN(utcDate.getTime())) {
      console.error('formatDateForAPI created invalid date:', utcDate);
      return new Date().toISOString();
    }
    
    // Return the UTC date as ISO string - this will represent the correct date
    return utcDate.toISOString();
  } catch (error) {
    console.error('formatDateForAPI error:', error, 'Input:', dateString);
    return new Date().toISOString();
  }
};

/**
 * Convert datetime input to API format
 * @param dateTimeString - DateTime string in ISO format or datetime-local format
 * @returns ISO string
 */
export const formatDateTimeForAPI = (dateTimeString: string): string => {
  if (!dateTimeString) return new Date().toISOString();
  return new Date(dateTimeString).toISOString();
};

/**
 * Get current date in YYYY-MM-DD format (local timezone)
 * @returns Current date string in local timezone
 */
export const getCurrentDateString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Convert a date string to YYYY-MM-DD format without timezone conversion
 * This prevents timezone-related date shifts
 * @param dateString - Date string (ISO or any format)
 * @returns Date string in YYYY-MM-DD format
 */
export const formatDateForInput = (dateString: string): string => {
  // Add comprehensive null/undefined checks
  if (!dateString || typeof dateString !== 'string') {
    console.error('formatDateForInput received invalid input:', dateString, 'Type:', typeof dateString);
    return new Date().toISOString().split('T')[0];
  }
  
  // If it's already in YYYY-MM-DD format, return as is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString;
  }
  
  try {
    // Parse the date and format it without timezone conversion
    const date = new Date(dateString);
    
    // Validate the parsed date
    if (isNaN(date.getTime())) {
      console.error('formatDateForInput failed to parse date:', dateString);
      return new Date().toISOString().split('T')[0];
    }
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('formatDateForInput error:', error, 'Input:', dateString);
    return new Date().toISOString().split('T')[0];
  }
};

/**
 * Format date for display in IST
 * @param dateString - Date string
 * @returns Formatted date string for display in IST
 */
export const formatDateForDisplay = (dateString: string): string => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    return date.toLocaleDateString('en-IN', {
      timeZone: IST_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid Date';
  }
};

/**
 * Get current datetime in ISO format
 * @returns Current datetime string
 */
export const getCurrentDateTimeString = (): string => {
  return new Date().toISOString();
};

/**
 * Format date for end of day (23:59:59.999Z)
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns ISO string with end of day
 */
export const formatDateEndOfDay = (dateString: string): string => {
  if (!dateString) return new Date().toISOString();
  return new Date(`${dateString}T23:59:59.999Z`).toISOString();
};

/**
 * Validate date string format
 * @param dateString - Date string to validate
 * @returns true if valid YYYY-MM-DD format
 */
export const isValidDateString = (dateString: string): boolean => {
  if (!dateString) return false;
  const date = new Date(dateString);
  return !isNaN(date.getTime()) && !!dateString.match(/^\d{4}-\d{2}-\d{2}$/);
};

/**
 * Validate datetime string format
 * @param dateTimeString - DateTime string to validate
 * @returns true if valid datetime format
 */
export const isValidDateTimeString = (dateTimeString: string): boolean => {
  if (!dateTimeString) return false;
  const date = new Date(dateTimeString);
  return !isNaN(date.getTime());
};

/**
 * Get date range for filtering (start and end of day)
 * @param startDate - Start date string
 * @param endDate - End date string
 * @returns Object with formatted start and end dates
 */
export const getDateRangeForFiltering = (startDate?: string, endDate?: string) => {
  return {
    startDate: startDate ? startDate : undefined, // Return as-is for backend processing
    endDate: endDate ? endDate : undefined, // Return as-is for backend processing
  };
};


/**
 * Format datetime for display
 * @param dateTimeString - DateTime string
 * @returns Formatted datetime string for display
 */
export const formatDateTimeForDisplay = (dateTimeString: string): string => {
  if (!dateTimeString) return '';
  try {
    const date = new Date(dateTimeString);
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    return date.toLocaleString('en-IN', {
      timeZone: IST_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } catch (error) {
    console.error('Error formatting datetime:', error);
    return 'Invalid Date';
  }
};

/**
 * Format date in DD/MM/YYYY format
 * @param dateInput - Date string, Date object, null, or undefined
 * @returns Formatted date string in DD/MM/YYYY format or 'N/A' for invalid inputs
 */
export const formatDateDDMMYYYY = (dateInput: string | Date | null | undefined): string => {
  if (!dateInput) return 'N/A';
  
  try {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(date.getTime())) {
      return 'N/A';
    }
    return date.toLocaleDateString('en-IN', {
      timeZone: IST_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  } catch (error) {
    console.error('Error formatting date DD/MM/YYYY:', error);
    return 'N/A';
  }
};

/**
 * Format date with day name
 * @param dateInput - Date string, Date object, null, or undefined
 * @returns Formatted date string with day name or 'N/A' for invalid inputs
 */
export const formatDateWithDayName = (dateInput: string | Date | null | undefined): string => {
  if (!dateInput) return 'N/A';
  
  try {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(date.getTime())) {
      return 'N/A';
    }
    return date.toLocaleDateString('en-IN', {
      timeZone: IST_TIMEZONE,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting date with day name:', error);
    return 'N/A';
  }
};

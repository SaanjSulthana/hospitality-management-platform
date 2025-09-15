/**
 * Date utility functions for consistent date/time handling across the application
 */

/**
 * Convert date input (YYYY-MM-DD) to API format with start of day in local timezone
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns ISO string with start of day in local timezone
 */
export const formatDateForAPI = (dateString: string): string => {
  if (!dateString) return new Date().toISOString();
  
  // Create date in local timezone to avoid timezone shift issues
  const [year, month, day] = dateString.split('-').map(Number);
  const localDate = new Date(year, month - 1, day, 0, 0, 0, 0); // month is 0-indexed
  
  return localDate.toISOString();
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
 * Get current date in YYYY-MM-DD format
 * @returns Current date string
 */
export const getCurrentDateString = (): string => {
  return new Date().toISOString().split('T')[0];
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
 * Format date for display
 * @param dateString - Date string
 * @returns Formatted date string for display
 */
export const formatDateForDisplay = (dateString: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Format datetime for display
 * @param dateTimeString - DateTime string
 * @returns Formatted datetime string for display
 */
export const formatDateTimeForDisplay = (dateTimeString: string): string => {
  if (!dateTimeString) return '';
  const date = new Date(dateTimeString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

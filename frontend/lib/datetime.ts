/**
 * Utility functions for consistent date and time formatting across the application
 */

export interface DateTimeOptions {
  includeTime?: boolean;
  includeSeconds?: boolean;
  includeTimezone?: boolean;
  format?: 'short' | 'medium' | 'long' | 'full';
}

/**
 * Formats a date with timestamp consistently across the application
 */
export function formatDateTime(
  date: string | Date | null | undefined,
  options: DateTimeOptions = {}
): string {
  if (!date) return 'N/A';

  const {
    includeTime = true,
    includeSeconds = false,
    includeTimezone = false,
    format = 'medium'
  } = options;

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) {
      return 'Invalid Date';
    }

    // Base date formatting
    let dateOptions: Intl.DateTimeFormatOptions = {};

    switch (format) {
      case 'short':
        dateOptions = {
          year: '2-digit',
          month: 'short',
          day: 'numeric'
        };
        break;
      case 'medium':
        dateOptions = {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        };
        break;
      case 'long':
        dateOptions = {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        };
        break;
      case 'full':
        dateOptions = {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          weekday: 'long'
        };
        break;
    }

    // Add time formatting if requested
    if (includeTime) {
      dateOptions.hour = '2-digit';
      dateOptions.minute = '2-digit';
      dateOptions.hour12 = true;

      if (includeSeconds) {
        dateOptions.second = '2-digit';
      }

      if (includeTimezone) {
        dateOptions.timeZoneName = 'short';
      }
    }

    return new Intl.DateTimeFormat('en-US', dateOptions).format(dateObj);
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid Date';
  }
}

/**
 * Formats date for transactions (includes time by default)
 */
export function formatTransactionDateTime(date: string | Date | null | undefined): string {
  return formatDateTime(date, {
    includeTime: true,
    includeSeconds: false,
    format: 'medium'
  });
}

/**
 * Formats date for user activities (includes time and is more detailed)
 */
export function formatUserActivityDateTime(date: string | Date | null | undefined): string {
  return formatDateTime(date, {
    includeTime: true,
    includeSeconds: true,
    format: 'medium'
  });
}

/**
 * Formats date for due dates and schedules
 */
export function formatDueDateTimeTime(date: string | Date | null | undefined): string {
  return formatDateTime(date, {
    includeTime: true,
    includeSeconds: false,
    format: 'short'
  });
}

/**
 * Gets relative time description (e.g., "2 hours ago", "in 3 days")
 */
export function getRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return 'Unknown';

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (Math.abs(diffMinutes) < 1) {
      return 'Just now';
    } else if (Math.abs(diffMinutes) < 60) {
      return diffMinutes > 0 ? `${diffMinutes} min ago` : `in ${Math.abs(diffMinutes)} min`;
    } else if (Math.abs(diffHours) < 24) {
      return diffHours > 0 ? `${diffHours}h ago` : `in ${Math.abs(diffHours)}h`;
    } else if (Math.abs(diffDays) < 7) {
      return diffDays > 0 ? `${diffDays}d ago` : `in ${Math.abs(diffDays)}d`;
    } else {
      return formatDateTime(date, { includeTime: false, format: 'short' });
    }
  } catch (error) {
    console.error('Error calculating relative time:', error);
    return 'Unknown';
  }
}

/**
 * Checks if a date is overdue
 */
export function isOverdue(date: string | Date | null | undefined): boolean {
  if (!date) return false;
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.getTime() < new Date().getTime();
  } catch (error) {
    return false;
  }
}

/**
 * Formats date for display in cards and lists with both date and time
 */
export function formatCardDateTime(date: string | Date | null | undefined): string {
  if (!date) return 'N/A';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // Check if it's today or yesterday
  if (dateObj.toDateString() === today.toDateString()) {
    return `Today, ${dateObj.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    })}`;
  } else if (dateObj.toDateString() === yesterday.toDateString()) {
    return `Yesterday, ${dateObj.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    })}`;
  } else {
    return formatTransactionDateTime(date);
  }
}

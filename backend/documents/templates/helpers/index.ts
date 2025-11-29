/**
 * Handlebars helper registry
 * Centralizes all template helpers for easy registration
 */

import Handlebars from 'handlebars';
import { formatCurrency, formatCurrencyShort } from './currency';
import { formatDate, formatDateRange } from './date';
import { formatNumber, formatPercentage, formatFileSize, add, subtract, multiply, divide } from './number';

export function registerHelpers(handlebars: typeof Handlebars): void {
  // Currency helpers
  handlebars.registerHelper('formatCurrency', formatCurrency);
  handlebars.registerHelper('formatCurrencyShort', formatCurrencyShort);
  
  // Date helpers
  handlebars.registerHelper('formatDate', formatDate);
  handlebars.registerHelper('formatDateRange', formatDateRange);
  
  // Number helpers
  handlebars.registerHelper('formatNumber', formatNumber);
  handlebars.registerHelper('formatPercentage', formatPercentage);
  handlebars.registerHelper('formatFileSize', formatFileSize);
  
  // Math helpers
  handlebars.registerHelper('add', add);
  handlebars.registerHelper('subtract', subtract);
  handlebars.registerHelper('multiply', multiply);
  handlebars.registerHelper('divide', divide);
  
  // Conditional helpers
  handlebars.registerHelper('eq', (a: any, b: any) => a === b);
  handlebars.registerHelper('ne', (a: any, b: any) => a !== b);
  handlebars.registerHelper('gt', (a: number, b: number) => a > b);
  handlebars.registerHelper('lt', (a: number, b: number) => a < b);
  handlebars.registerHelper('gte', (a: number, b: number) => a >= b);
  handlebars.registerHelper('lte', (a: number, b: number) => a <= b);
  handlebars.registerHelper('and', (...args: any[]) => {
    // Remove options object (last argument)
    return args.slice(0, -1).every(Boolean);
  });
  handlebars.registerHelper('or', (...args: any[]) => {
    // Remove options object (last argument)
    return args.slice(0, -1).some(Boolean);
  });
  
  // Utility helpers
  handlebars.registerHelper('json', (context: any) => JSON.stringify(context, null, 2));
  handlebars.registerHelper('uppercase', (str: string) => str?.toUpperCase() || '');
  handlebars.registerHelper('lowercase', (str: string) => str?.toLowerCase() || '');
  handlebars.registerHelper('capitalize', (str: string) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  });
  
  console.log('[Handlebars] Helpers registered successfully');
}

// Export helper functions for direct use
export { 
  formatCurrency, 
  formatCurrencyShort,
  formatDate,
  formatDateRange,
  formatNumber,
  formatPercentage,
  formatFileSize,
  add,
  subtract,
  multiply,
  divide,
};


/**
 * Currency formatting helper for Handlebars templates
 */

export function formatCurrency(cents: number): string {
  if (typeof cents !== 'number') {
    return '₹0.00';
  }
  
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatCurrencyShort(cents: number): string {
  if (typeof cents !== 'number') {
    return '₹0';
  }
  
  const value = cents / 100;
  
  if (Math.abs(value) >= 10000000) { // 1 crore or more
    return `₹${(value / 10000000).toFixed(2)}Cr`;
  } else if (Math.abs(value) >= 100000) { // 1 lakh or more
    return `₹${(value / 100000).toFixed(2)}L`;
  } else if (Math.abs(value) >= 1000) { // 1 thousand or more
    return `₹${(value / 1000).toFixed(1)}K`;
  }
  
  return `₹${value.toFixed(2)}`;
}


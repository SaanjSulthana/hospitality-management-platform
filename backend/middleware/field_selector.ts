/**
 * Sparse Field Selector (fields= parameter)
 * 
 * Implements field selection for top payload-heavy endpoints:
 * - v1/finance/expenses (list)
 * - v1/finance/revenues (list)
 * - v1/reports/daily-report
 * - v1/reports/monthly-report
 * - v1/reports/date-transactions
 * - v1/guest-checkin/list
 * - v1/staff/attendance
 * - v1/staff/leave-requests
 * - v1/properties (list)
 * - v1/users/properties
 * 
 * Combines with pagination and normalization for maximum payload reduction.
 * 
 * @see docs/NETWORKING_AND_REALTIME_IMPROVEMENTS.md fields= Selector section
 */

/**
 * Field specification for an endpoint
 */
export interface FieldSpec {
  /** All available fields */
  allFields: string[];
  
  /** Default fields if none specified */
  defaultFields: string[];
  
  /** Fields that are always included */
  requiredFields: string[];
  
  /** Fields that can be expanded (nested objects) */
  expandableFields?: string[];
  
  /** Field aliases (for backwards compatibility) */
  aliases?: Record<string, string>;
}

/**
 * Predefined field specifications by endpoint
 */
export const FIELD_SPECS: Record<string, FieldSpec> = {
  // Finance - Expenses
  'finance/expenses': {
    allFields: [
      'id', 'propertyId', 'propertyName', 'amountCents', 'category',
      'description', 'paymentMode', 'bankReference', 'expenseDate',
      'status', 'createdByUserId', 'createdByName', 'createdAt',
      'approvedByUserId', 'approvedByName', 'approvedAt', 'receiptFileId',
    ],
    defaultFields: [
      'id', 'propertyId', 'propertyName', 'amountCents', 'category',
      'description', 'paymentMode', 'expenseDate', 'status', 'createdByName',
    ],
    requiredFields: ['id', 'propertyId', 'amountCents'],
  },
  
  // Finance - Revenues
  'finance/revenues': {
    allFields: [
      'id', 'propertyId', 'propertyName', 'amountCents', 'source',
      'description', 'paymentMode', 'bankReference', 'occurredAt',
      'status', 'createdByUserId', 'createdByName', 'createdAt',
      'approvedByUserId', 'approvedByName', 'approvedAt', 'receiptFileId',
    ],
    defaultFields: [
      'id', 'propertyId', 'propertyName', 'amountCents', 'source',
      'description', 'paymentMode', 'occurredAt', 'status', 'createdByName',
    ],
    requiredFields: ['id', 'propertyId', 'amountCents'],
  },
  
  // Reports - Daily
  'reports/daily-report': {
    allFields: [
      'date', 'propertyId', 'propertyName', 'openingBalanceCents',
      'cashReceivedCents', 'bankReceivedCents', 'totalReceivedCents',
      'cashExpensesCents', 'bankExpensesCents', 'totalExpensesCents',
      'closingBalanceCents', 'netCashFlowCents', 'isOpeningBalanceAutoCalculated',
      'calculatedClosingBalanceCents', 'balanceDiscrepancyCents',
      'transactions', 'cashBalance',
    ],
    defaultFields: [
      'date', 'propertyId', 'propertyName', 'totalReceivedCents',
      'totalExpensesCents', 'closingBalanceCents', 'netCashFlowCents',
    ],
    requiredFields: ['date', 'propertyId'],
    expandableFields: ['transactions'],
  },
  
  // Reports - Monthly
  'reports/monthly-report': {
    allFields: [
      'year', 'month', 'monthName', 'propertyId', 'propertyName',
      'openingBalanceCents', 'totalCashReceivedCents', 'totalBankReceivedCents',
      'totalCashExpensesCents', 'totalBankExpensesCents', 'closingBalanceCents',
      'netCashFlowCents', 'profitMargin', 'transactionCount', 'dailyReports',
    ],
    defaultFields: [
      'year', 'month', 'monthName', 'propertyId', 'propertyName',
      'totalCashReceivedCents', 'totalCashExpensesCents', 'closingBalanceCents',
      'netCashFlowCents', 'profitMargin',
    ],
    requiredFields: ['year', 'month', 'propertyId'],
    expandableFields: ['dailyReports'],
  },
  
  // Guest Check-in
  'guest-checkin/list': {
    allFields: [
      'id', 'propertyId', 'propertyName', 'guestType', 'fullName',
      'email', 'phone', 'address', 'aadharNumber', 'passportNumber',
      'nationality', 'roomNumber', 'numberOfGuests', 'checkInDate',
      'expectedCheckoutDate', 'actualCheckoutDate', 'status',
      'createdByUserId', 'createdByName', 'createdAt', 'documents',
    ],
    defaultFields: [
      'id', 'propertyId', 'guestType', 'fullName', 'phone',
      'roomNumber', 'checkInDate', 'expectedCheckoutDate', 'status',
    ],
    requiredFields: ['id', 'propertyId', 'fullName', 'status'],
    expandableFields: ['documents'],
  },
  
  // Staff - Attendance
  'staff/attendance': {
    allFields: [
      'id', 'staffId', 'staffName', 'propertyId', 'propertyName',
      'date', 'checkInTime', 'checkOutTime', 'status', 'workHours',
      'overtimeHours', 'notes', 'createdAt', 'updatedAt',
    ],
    defaultFields: [
      'id', 'staffId', 'staffName', 'date', 'checkInTime',
      'checkOutTime', 'status', 'workHours',
    ],
    requiredFields: ['id', 'staffId', 'date'],
  },
  
  // Staff - Leave Requests
  'staff/leave-requests': {
    allFields: [
      'id', 'staffId', 'staffName', 'propertyId', 'propertyName',
      'leaveType', 'startDate', 'endDate', 'reason', 'status',
      'halfDay', 'approvedByUserId', 'approvedByName', 'approvedAt',
      'notes', 'createdAt', 'updatedAt',
    ],
    defaultFields: [
      'id', 'staffId', 'staffName', 'leaveType', 'startDate',
      'endDate', 'status', 'halfDay',
    ],
    requiredFields: ['id', 'staffId', 'startDate', 'endDate', 'status'],
  },
  
  // Properties
  'properties': {
    allFields: [
      'id', 'name', 'type', 'status', 'addressJson', 'capacityJson',
      'amenitiesJson', 'createdAt', 'updatedAt', 'orgId',
      'managerCount', 'staffCount', 'currentOccupancy',
    ],
    defaultFields: [
      'id', 'name', 'type', 'status', 'addressJson', 'capacityJson',
    ],
    requiredFields: ['id', 'name', 'type', 'status'],
    expandableFields: ['amenitiesJson'],
  },
  
  // Users - Properties
  'users/properties': {
    allFields: [
      'userId', 'userEmail', 'userName', 'propertyId', 'propertyName',
      'propertyType', 'role', 'assignedAt', 'assignedByUserId',
    ],
    defaultFields: [
      'userId', 'userName', 'propertyId', 'propertyName', 'role',
    ],
    requiredFields: ['userId', 'propertyId'],
  },
};

/**
 * Parse fields parameter from query string
 * 
 * Formats supported:
 * - fields=id,name,status (comma-separated)
 * - fields=id&fields=name (repeated)
 * - fields[]=id&fields[]=name (array notation)
 */
export function parseFieldsParam(
  param: string | string[] | undefined | null
): string[] {
  if (!param) return [];
  
  if (Array.isArray(param)) {
    return param.flatMap(p => p.split(',').map(f => f.trim())).filter(Boolean);
  }
  
  return param.split(',').map(f => f.trim()).filter(Boolean);
}

/**
 * Resolve fields for a request
 * 
 * @param endpoint - Endpoint key (e.g., 'finance/expenses')
 * @param requestedFields - Fields requested by client
 * @param expand - Fields to expand (nested objects)
 * @returns Resolved list of fields to include
 */
export function resolveFields(
  endpoint: string,
  requestedFields: string[],
  expand?: string[]
): string[] {
  const spec = FIELD_SPECS[endpoint];
  
  if (!spec) {
    // Unknown endpoint - return all requested fields
    return requestedFields;
  }
  
  // Start with required fields
  const fields = new Set<string>(spec.requiredFields);
  
  // If no fields requested, use defaults
  const fieldsToUse = requestedFields.length > 0 
    ? requestedFields 
    : spec.defaultFields;
  
  // Add requested fields (if they exist in allFields)
  for (const field of fieldsToUse) {
    // Check for alias
    const actualField = spec.aliases?.[field] ?? field;
    
    if (spec.allFields.includes(actualField)) {
      fields.add(actualField);
    }
  }
  
  // Add expanded fields
  if (expand && spec.expandableFields) {
    for (const field of expand) {
      if (spec.expandableFields.includes(field)) {
        fields.add(field);
      }
    }
  }
  
  return Array.from(fields);
}

/**
 * Filter object to only include specified fields
 */
export function filterFields<T extends object>(
  obj: T,
  fields: string[]
): Partial<T> {
  const fieldsSet = new Set(fields);
  const result: Partial<T> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (fieldsSet.has(key)) {
      (result as any)[key] = value;
    }
  }
  
  return result;
}

/**
 * Filter array of objects to only include specified fields
 */
export function filterArrayFields<T extends object>(
  arr: T[],
  fields: string[]
): Partial<T>[] {
  return arr.map(obj => filterFields(obj, fields));
}

/**
 * Apply field selection to a response
 * 
 * Handles both single objects and arrays.
 */
export function applyFieldSelection<T extends object | object[]>(
  data: T,
  fields: string[]
): T extends object[] ? Partial<T[number]>[] : Partial<T> {
  if (fields.length === 0) {
    return data as any;
  }
  
  if (Array.isArray(data)) {
    return filterArrayFields(data, fields) as any;
  }
  
  return filterFields(data, fields) as any;
}

/**
 * Calculate payload size savings from field selection
 */
export function calculatePayloadSavings(
  original: object | object[],
  filtered: object | object[]
): {
  originalSize: number;
  filteredSize: number;
  savedBytes: number;
  savedPercent: number;
} {
  const originalSize = Buffer.byteLength(JSON.stringify(original), 'utf-8');
  const filteredSize = Buffer.byteLength(JSON.stringify(filtered), 'utf-8');
  const savedBytes = originalSize - filteredSize;
  const savedPercent = originalSize > 0 ? (savedBytes / originalSize) * 100 : 0;
  
  return {
    originalSize,
    filteredSize,
    savedBytes,
    savedPercent: Math.round(savedPercent * 10) / 10,
  };
}

/**
 * Field selection middleware helper
 * 
 * Usage:
 * ```typescript
 * const fieldSelector = createFieldSelector('finance/expenses', req.query.fields);
 * 
 * // After fetching data
 * const filteredData = fieldSelector.apply(data);
 * const headers = fieldSelector.getHeaders();
 * ```
 */
export function createFieldSelector(
  endpoint: string,
  requestedFields: string | string[] | undefined,
  expand?: string | string[] | undefined
) {
  const parsedFields = parseFieldsParam(requestedFields);
  const parsedExpand = parseFieldsParam(expand);
  const resolvedFields = resolveFields(endpoint, parsedFields, parsedExpand);
  
  return {
    /** Resolved fields that will be returned */
    fields: resolvedFields,
    
    /** Whether custom fields were requested */
    hasCustomFields: parsedFields.length > 0,
    
    /** Apply field selection to data */
    apply: <T extends object | object[]>(data: T) => {
      if (parsedFields.length === 0) {
        return data; // No filtering if no fields specified
      }
      return applyFieldSelection(data, resolvedFields);
    },
    
    /** Get response headers */
    getHeaders: () => ({
      'X-Fields-Returned': resolvedFields.join(','),
      'X-Fields-Available': FIELD_SPECS[endpoint]?.allFields.join(',') ?? '',
    }),
    
    /** Calculate savings (for logging) */
    calculateSavings: <T extends object | object[]>(original: T, filtered: T) =>
      calculatePayloadSavings(original, filtered),
  };
}

/**
 * Get available fields for an endpoint
 */
export function getAvailableFields(endpoint: string): string[] | null {
  return FIELD_SPECS[endpoint]?.allFields ?? null;
}

/**
 * Get default fields for an endpoint
 */
export function getDefaultFields(endpoint: string): string[] | null {
  return FIELD_SPECS[endpoint]?.defaultFields ?? null;
}

/**
 * Check if an endpoint supports field selection
 */
export function supportsFieldSelection(endpoint: string): boolean {
  return endpoint in FIELD_SPECS;
}

/**
 * Normalize endpoint path to spec key
 */
export function normalizeEndpointPath(path: string): string {
  // Remove leading slash, version prefix, and trailing slashes
  return path
    .replace(/^\/+/, '')
    .replace(/^v\d+\//, '')
    .replace(/\/+$/, '')
    .toLowerCase();
}

/**
 * Get field selector for a request path
 */
export function getFieldSelectorForPath(
  path: string,
  fields?: string | string[],
  expand?: string | string[]
) {
  const normalizedPath = normalizeEndpointPath(path);
  return createFieldSelector(normalizedPath, fields, expand);
}

// Statistics for monitoring
let fieldSelectionStats = {
  requests: 0,
  customFieldRequests: 0,
  totalBytesSaved: 0,
  avgSavingsPercent: 0,
};

/**
 * Record field selection statistics
 */
export function recordFieldSelectionStats(
  hasCustomFields: boolean,
  bytesSaved: number,
  savingsPercent: number
): void {
  fieldSelectionStats.requests++;
  
  if (hasCustomFields) {
    fieldSelectionStats.customFieldRequests++;
    fieldSelectionStats.totalBytesSaved += bytesSaved;
    fieldSelectionStats.avgSavingsPercent = (
      fieldSelectionStats.avgSavingsPercent * (fieldSelectionStats.customFieldRequests - 1) +
      savingsPercent
    ) / fieldSelectionStats.customFieldRequests;
  }
}

/**
 * Get field selection statistics
 */
export function getFieldSelectionStats(): typeof fieldSelectionStats {
  return { ...fieldSelectionStats };
}

/**
 * Reset statistics
 */
export function resetFieldSelectionStats(): void {
  fieldSelectionStats = {
    requests: 0,
    customFieldRequests: 0,
    totalBytesSaved: 0,
    avgSavingsPercent: 0,
  };
}

// Export types
export type { FieldSpec };


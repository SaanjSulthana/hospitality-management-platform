/**
 * 🔥 CRITICAL FOR 1M ORGS: Centralized Event Validation & Type Safety
 * 
 * This module ensures:
 * 1. Only valid event types reach the financeEvents topic
 * 2. All required fields are present
 * 3. Backward compatibility with legacy event names
 * 4. Type-safe event publishing across all services
 * 5. Comprehensive validation for production scale
 */

import { APIError } from "encore.dev/api";
import { FinanceEventPayload } from "./events";
import { v4 as uuidv4 } from 'uuid';

// All valid event types from the schema
export const VALID_EVENT_TYPES: ReadonlyArray<FinanceEventPayload['eventType']> = [
  'expense_added',
  'expense_updated',
  'expense_deleted',
  'expense_approved',
  'expense_rejected',
  'revenue_added',
  'revenue_updated',
  'revenue_deleted',
  'revenue_approved',
  'revenue_rejected',
  'daily_approval_granted',
  'cash_balance_updated',
] as const;

// Legacy event type mappings for backward compatibility
const LEGACY_EVENT_TYPE_MAP: Record<string, FinanceEventPayload['eventType']> = {
  'transaction_created': 'revenue_added',  // Default to revenue, but should specify
  'transaction_approved': 'revenue_approved', // Default, but requires entityType
  'transaction_updated': 'revenue_updated',
  'transaction_deleted': 'revenue_deleted',
  'balance_updated': 'cash_balance_updated',
};

/**
 * Event builder input (flexible for API calls)
 */
export interface EventBuilderInput {
  eventType: string;  // Can be legacy or valid
  orgId: number;
  propertyId?: number;
  userId?: number;
  entityId?: number | string;
  entityType?: 'expense' | 'revenue' | 'daily_approval' | 'cash_balance' | string;
  metadata?: Partial<FinanceEventPayload['metadata']>;
}

/**
 * Maps legacy event types to current valid types
 * Throws error if mapping is ambiguous
 */
export function mapEventType(
  input: string,
  entityType?: string
): FinanceEventPayload['eventType'] {
  // Check if already valid
  if (VALID_EVENT_TYPES.includes(input as any)) {
    return input as FinanceEventPayload['eventType'];
  }

  // Handle legacy "transaction_approved" with context
  if (input === 'transaction_approved') {
    if (entityType === 'revenue') return 'revenue_approved';
    if (entityType === 'expense') return 'expense_approved';
    
    // Throw descriptive error for invalid usage
    throw APIError.invalidArgument(
      `Event type 'transaction_approved' requires entityType 'revenue' or 'expense'. ` +
      `Provided: ${entityType || 'none'}. ` +
      `Use 'revenue_approved' or 'expense_approved' instead.`
    );
  }

  // Handle other legacy types
  if (input in LEGACY_EVENT_TYPE_MAP) {
    console.warn(
      `[EventValidator] Legacy event type '${input}' mapped to '${LEGACY_EVENT_TYPE_MAP[input]}'. ` +
      `Please update to use the new event type.`
    );
    return LEGACY_EVENT_TYPE_MAP[input];
  }

  // Unknown event type - provide helpful error
  throw APIError.invalidArgument(
    `Invalid event type: '${input}'. ` +
    `Valid types: ${VALID_EVENT_TYPES.join(', ')}. ` +
    `Legacy types that can be mapped: ${Object.keys(LEGACY_EVENT_TYPE_MAP).join(', ')}.`
  );
}

/**
 * Infers entity type from event type if not provided
 */
export function inferEntityType(
  eventType: FinanceEventPayload['eventType']
): FinanceEventPayload['entityType'] {
  if (eventType.includes('expense')) return 'expense';
  if (eventType.includes('revenue')) return 'revenue';
  if (eventType.includes('approval')) return 'daily_approval';
  if (eventType.includes('balance')) return 'cash_balance';
  
  // Default fallback
  return 'cash_balance';
}

/**
 * 🔥 CRITICAL: Validates and builds a type-safe FinanceEventPayload
 * 
 * This is the ONLY way events should be published to ensure:
 * - Type safety
 * - Required fields are present
 * - Consistent event structure
 * - Monitoring and auditing
 */
export function buildValidatedEvent(
  input: EventBuilderInput,
  authUserId?: number
): FinanceEventPayload {
  // Validate required fields
  if (!input.orgId) {
    throw APIError.invalidArgument("orgId is required");
  }

  // Map and validate event type
  const eventType = mapEventType(input.eventType, input.entityType);

  // Infer entity type if not provided
  const entityType = (input.entityType as FinanceEventPayload['entityType']) || 
                     inferEntityType(eventType);

  // Validate entity type
  const validEntityTypes: FinanceEventPayload['entityType'][] = [
    'expense', 'revenue', 'daily_approval', 'cash_balance'
  ];
  if (!validEntityTypes.includes(entityType)) {
    throw APIError.invalidArgument(
      `Invalid entityType: '${input.entityType}'. Valid types: ${validEntityTypes.join(', ')}`
    );
  }

  // Ensure propertyId is present (required for most events)
  let propertyId = input.propertyId;
  if (propertyId === undefined || propertyId === null) {
    // Only daily_approval and some cash_balance events can have propertyId = 0
    if (entityType === 'daily_approval' || entityType === 'cash_balance') {
      propertyId = 0;
    } else {
      throw APIError.invalidArgument(
        `propertyId is required for event type '${eventType}'`
      );
    }
  }

  // Ensure userId is present
  const userId = input.userId || authUserId;
  if (!userId) {
    throw APIError.invalidArgument(
      "userId is required. Pass it explicitly or provide authUserId parameter."
    );
  }

  // Convert entityId to number if string
  let entityId = 0;
  if (input.entityId !== undefined && input.entityId !== null) {
    if (typeof input.entityId === 'string') {
      entityId = parseInt(input.entityId, 10);
      if (isNaN(entityId)) {
        throw APIError.invalidArgument(
          `entityId must be a number or numeric string. Got: ${input.entityId}`
        );
      }
    } else {
      entityId = input.entityId;
    }
  }

  // Build the validated event payload
  const event: FinanceEventPayload = {
    eventId: uuidv4(),
    eventVersion: 'v1',
    eventType,
    orgId: input.orgId,
    propertyId,
    userId,
    timestamp: new Date(),
    entityId,
    entityType,
    metadata: input.metadata || {}
  };

  // Validate metadata if present
  if (input.metadata) {
    validateMetadata(event.metadata, eventType);
  }

  // Log event creation for monitoring
  console.log(
    `[EventValidator] ✅ Built valid event: ${eventType} ` +
    `(orgId=${input.orgId}, propertyId=${propertyId}, entityType=${entityType})`
  );

  return event;
}

/**
 * Validates metadata fields based on event type
 */
function validateMetadata(
  metadata: Partial<FinanceEventPayload['metadata']>,
  eventType: FinanceEventPayload['eventType']
): void {
  // Validate transactionDate format if present
  if (metadata.transactionDate) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(metadata.transactionDate)) {
      throw APIError.invalidArgument(
        `transactionDate must be in YYYY-MM-DD format. Got: ${metadata.transactionDate}`
      );
    }
  }

  // Validate affectedReportDates if present
  if (metadata.affectedReportDates) {
    if (!Array.isArray(metadata.affectedReportDates)) {
      throw APIError.invalidArgument(
        "affectedReportDates must be an array of date strings"
      );
    }
    
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    for (const date of metadata.affectedReportDates) {
      if (!dateRegex.test(date)) {
        throw APIError.invalidArgument(
          `Each date in affectedReportDates must be in YYYY-MM-DD format. Got: ${date}`
        );
      }
    }
  }

  // Validate paymentMode if present
  if (metadata.paymentMode && !['cash', 'bank'].includes(metadata.paymentMode)) {
    throw APIError.invalidArgument(
      `paymentMode must be 'cash' or 'bank'. Got: ${metadata.paymentMode}`
    );
  }

  // Validate amountCents if present
  if (metadata.amountCents !== undefined) {
    if (typeof metadata.amountCents !== 'number' || metadata.amountCents < 0) {
      throw APIError.invalidArgument(
        `amountCents must be a non-negative number. Got: ${metadata.amountCents}`
      );
    }
  }
}

/**
 * Event validation statistics for monitoring
 */
export class EventValidationMonitor {
  private stats = {
    totalValidated: 0,
    validEvents: 0,
    invalidEvents: 0,
    legacyMappings: 0,
    byEventType: new Map<string, number>(),
    byErrorType: new Map<string, number>(),
  };

  recordValidation(eventType: string, isValid: boolean, errorType?: string): void {
    this.stats.totalValidated++;
    
    if (isValid) {
      this.stats.validEvents++;
      const count = this.stats.byEventType.get(eventType) || 0;
      this.stats.byEventType.set(eventType, count + 1);
    } else {
      this.stats.invalidEvents++;
      if (errorType) {
        const count = this.stats.byErrorType.get(errorType) || 0;
        this.stats.byErrorType.set(errorType, count + 1);
      }
    }
  }

  recordLegacyMapping(): void {
    this.stats.legacyMappings++;
  }

  getStats() {
    return {
      ...this.stats,
      validationRate: this.stats.validEvents / this.stats.totalValidated,
      invalidRate: this.stats.invalidEvents / this.stats.totalValidated,
      legacyRate: this.stats.legacyMappings / this.stats.totalValidated,
      eventTypeDistribution: Object.fromEntries(this.stats.byEventType),
      errorDistribution: Object.fromEntries(this.stats.byErrorType),
    };
  }

  checkAlerts(): string[] {
    const alerts: string[] = [];
    
    // Alert if invalid rate is too high
    const invalidRate = this.stats.invalidEvents / this.stats.totalValidated;
    if (invalidRate > 0.01) { // More than 1% invalid
      alerts.push(
        `⚠️ High invalid event rate: ${(invalidRate * 100).toFixed(2)}% ` +
        `(${this.stats.invalidEvents}/${this.stats.totalValidated})`
      );
    }

    // Alert if legacy mappings are still happening
    const legacyRate = this.stats.legacyMappings / this.stats.totalValidated;
    if (legacyRate > 0.05) { // More than 5% legacy
      alerts.push(
        `⚠️ High legacy event usage: ${(legacyRate * 100).toFixed(2)}% ` +
        `(${this.stats.legacyMappings}/${this.stats.totalValidated}). ` +
        `Please migrate to new event types.`
      );
    }

    return alerts;
  }
}

// Global monitor instance for tracking
export const eventValidationMonitor = new EventValidationMonitor();


/**
 * TypeScript types for LLM Document Extraction Service
 */

export type DocumentType = 
  | 'aadhaar_front' 
  | 'aadhaar_back' 
  | 'pan_card' 
  | 'driving_license_front'
  | 'driving_license_back'
  | 'election_card_front'
  | 'election_card_back'
  | 'passport' 
  | 'visa_front' 
  | 'visa_back'
  | 'other';

export interface FieldExtraction {
  value: string;
  confidence: number;
  needsVerification: boolean;
}

export interface LLMExtractionRequest {
  imageBase64: string;
  documentType: DocumentType;
  side?: 'front' | 'back';
}

export interface LLMExtractionResponse {
  success: boolean;
  documentType: string;
  fields: Record<string, FieldExtraction>;
  overallConfidence: number;
  processingTime: number;
  error?: string;
}

// Aadhaar-specific fields
export interface AadhaarFields {
  fullName: FieldExtraction;
  aadharNumber: FieldExtraction;
  dateOfBirth?: FieldExtraction;
  address?: FieldExtraction;
  gender?: FieldExtraction;
}

// Passport-specific fields
export interface PassportFields {
  fullName: FieldExtraction;
  passportNumber: FieldExtraction;
  dateOfBirth: FieldExtraction;
  nationality: FieldExtraction;
  expiryDate?: FieldExtraction;
  issueDate?: FieldExtraction;
}

// PAN card-specific fields
export interface PANFields {
  fullName: FieldExtraction;
  panNumber: FieldExtraction;
  dateOfBirth?: FieldExtraction;
}

// Visa-specific fields
export interface VisaFields {
  fullName?: FieldExtraction;
  visaType: FieldExtraction;
  visaNumber?: FieldExtraction;
  issueDate?: FieldExtraction;
  expiryDate: FieldExtraction;
  country: FieldExtraction;
}

// Driving License-specific fields
export interface DrivingLicenseFields {
  fullName: FieldExtraction;
  licenseNumber: FieldExtraction;
  dateOfBirth?: FieldExtraction;
  address?: FieldExtraction;
  fatherHusbandName?: FieldExtraction;
  bloodGroup?: FieldExtraction;
  vehicleClasses?: FieldExtraction;
  issueDate?: FieldExtraction;
  validityFrom?: FieldExtraction;
  validityTo?: FieldExtraction;
  issuingAuthority?: FieldExtraction;
  testingAuthority?: FieldExtraction;
}

// Election Card-specific fields
export interface ElectionCardFields {
  fullName: FieldExtraction;
  epicNumber: FieldExtraction;
  relationName?: FieldExtraction;
  address?: FieldExtraction;
  dateOfBirth?: FieldExtraction;
  age?: FieldExtraction;
  gender?: FieldExtraction;
  constituencyNumber?: FieldExtraction;
  constituencyName?: FieldExtraction;
  partNumber?: FieldExtraction;
  partName?: FieldExtraction;
}

// Document type detection response
export interface DocumentTypeDetection {
  documentType: DocumentType;
  confidence: number;
  reasoning: string;
  alternativeTypes?: Array<{
    type: DocumentType;
    confidence: number;
    reasoning: string;
  }>;
}

// OpenAI API configuration
export interface OpenAIConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  timeout: number;
}

// Retry configuration
export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

// Rate limit tracking
export interface RateLimitState {
  requestCount: number;
  windowStart: number;
  limit: number;
  windowDurationMs: number;
}


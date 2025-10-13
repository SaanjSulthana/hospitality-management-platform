/**
 * LLM Service for Document Text Extraction
 * Uses OpenAI GPT-4 Vision to extract structured data from ID documents
 */

import OpenAI from "openai";
import log from "encore.dev/log";
import { secret } from "encore.dev/config";
import { readFileSync } from "fs";
import { join } from "path";
import type {
  DocumentType,
  LLMExtractionResponse,
  FieldExtraction,
  RetryConfig,
  RateLimitState,
  DocumentTypeDetection,
} from "./llm-types";

// Configuration
const OPENAI_MODEL = "gpt-4o";
const MAX_TOKENS = 500;
const TIMEOUT_MS = 30000; // 30 seconds
const CONFIDENCE_THRESHOLD = 80; // Fields below this need verification
const CRITICAL_FIELDS_THRESHOLD = 90; // ID numbers need higher confidence

// Retry configuration
const RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

// Rate limiting: 10 requests per minute per organization
const rateLimitMap = new Map<number, RateLimitState>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60000; // 1 minute

// Initialize OpenAI client
let openaiClient: OpenAI | null = null;

// Get OpenAI API key from Encore secrets
const openaiApiKey = secret("OpenAI_API_Key");

function getOpenAIClient(): OpenAI | null {
  if (!openaiClient) {
    const apiKey = openaiApiKey();
    
    // Add detailed debugging
    log.info("OpenAI API key debug", {
      hasApiKey: !!apiKey,
      keyLength: apiKey ? apiKey.length : 0,
      keyPrefix: apiKey ? apiKey.substring(0, 8) + "..." : "null",
      keyType: typeof apiKey
    });
    
    if (!apiKey) {
      log.warn("OpenAI API key not configured - using mock mode for demo purposes");
      return null; // Return null to trigger mock mode
    }
    
    openaiClient = new OpenAI({
      apiKey,
      timeout: TIMEOUT_MS,
    });
    
    log.info("OpenAI client created successfully");
  }
  
  return openaiClient;
}

// Load prompt templates
function loadPrompt(documentType: DocumentType): string {
  const promptMap: Record<string, string> = {
    aadhaar_front: "aadhaar-extraction.txt",
    aadhaar_back: "aadhaar-extraction.txt",
    pan_card: "pan-extraction.txt",
    passport: "passport-extraction.txt",
    visa_front: "visa-extraction.txt",
    visa_back: "visa-extraction.txt",
    driving_license_front: "driving-license-extraction.txt",
    driving_license_back: "driving-license-extraction.txt",
    election_card_front: "election-card-extraction.txt",
    election_card_back: "election-card-extraction.txt",
  };

  const promptFile = promptMap[documentType] || "aadhaar-extraction.txt";
  const promptPath = join(process.cwd(), "guest-checkin", "prompts", promptFile);
  
  try {
    return readFileSync(promptPath, "utf-8");
  } catch (error) {
    log.warn("Failed to load prompt file, using default", { documentType, error });
    return "Extract all text from this document and return as structured JSON with confidence scores.";
  }
}

// Check and update rate limit
function checkRateLimit(orgId: number): boolean {
  const now = Date.now();
  const state = rateLimitMap.get(orgId) || {
    requestCount: 0,
    windowStart: now,
    limit: RATE_LIMIT,
    windowDurationMs: RATE_WINDOW_MS,
  };

  // Reset window if expired
  if (now - state.windowStart > state.windowDurationMs) {
    state.requestCount = 0;
    state.windowStart = now;
  }

  // Check if limit exceeded
  if (state.requestCount >= state.limit) {
    return false;
  }

  // Increment and update
  state.requestCount++;
  rateLimitMap.set(orgId, state);
  return true;
}

// Exponential backoff delay
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Validate extracted data format
function validateField(
  fieldName: string,
  value: string,
  documentType: DocumentType
): boolean {
  // Aadhaar number: exactly 12 digits
  if (fieldName === "aadharNumber") {
    return /^\d{4}\s\d{4}\s\d{4}$/.test(value) || /^\d{12}$/.test(value);
  }

  // PAN number: 5 letters + 4 digits + 1 letter
  if (fieldName === "panNumber") {
    return /^[A-Z]{5}\d{4}[A-Z]$/.test(value);
  }

  // Date format: YYYY-MM-DD
  if (fieldName.includes("Date") || fieldName.includes("OfBirth")) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
  }

  // Passport number: varies, but typically 6-9 alphanumeric
  if (fieldName === "passportNumber") {
    return /^[A-Z0-9]{6,9}$/.test(value);
  }

  return true; // Other fields pass basic validation
}

// Calculate overall confidence from all fields
export function calculateOverallConfidence(
  fields: Record<string, FieldExtraction>
): number {
  const confidenceScores = Object.values(fields).map((f) => f.confidence);
  
  if (confidenceScores.length === 0) {
    return 0;
  }

  const sum = confidenceScores.reduce((acc, score) => acc + score, 0);
  const average = sum / confidenceScores.length;
  
  return Math.round(average);
}

// Determine if field needs manual verification
function needsVerification(
  fieldName: string,
  confidence: number,
  value: string,
  documentType: DocumentType
): boolean {
  // Critical fields (ID numbers) need higher confidence
  const criticalFields = ["aadharNumber", "panNumber", "passportNumber", "visaNumber"];
  
  if (criticalFields.includes(fieldName)) {
    if (confidence < CRITICAL_FIELDS_THRESHOLD) {
      return true;
    }
    // Also verify if format validation fails
    if (!validateField(fieldName, value, documentType)) {
      return true;
    }
  }

  // Other fields need standard confidence
  return confidence < CONFIDENCE_THRESHOLD;
}

// Parse and validate OpenAI response
function parseExtractionResponse(
  content: string,
  documentType: DocumentType
): Record<string, FieldExtraction> {
  try {
    // Remove markdown code blocks if present
    let cleanContent = content.trim();
    if (cleanContent.startsWith("```json")) {
      cleanContent = cleanContent.replace(/```json\n?/g, "").replace(/```\n?/g, "");
    } else if (cleanContent.startsWith("```")) {
      cleanContent = cleanContent.replace(/```\n?/g, "");
    }

    const parsed = JSON.parse(cleanContent);
    const fields: Record<string, FieldExtraction> = {};

    // Process each field
    for (const [fieldName, fieldData] of Object.entries(parsed)) {
      if (typeof fieldData === "object" && fieldData !== null) {
        const data = fieldData as { value: string; confidence: number };
        
        fields[fieldName] = {
          value: data.value,
          confidence: data.confidence,
          needsVerification: needsVerification(
            fieldName,
            data.confidence,
            data.value,
            documentType
          ),
        };
      }
    }

    return fields;
  } catch (error) {
    log.error("Failed to parse LLM response", { error, content });
    throw new Error("Invalid JSON response from LLM");
  }
}

/**
 * Detect document type from image using OpenAI GPT-4 Vision
 */
export async function detectDocumentType(
  imageBase64: string,
  orgId: number = 1
): Promise<DocumentTypeDetection> {
  const startTime = Date.now();
  
  try {
    // Check rate limits
    if (!checkRateLimit(orgId)) {
      return {
        documentType: 'other',
        confidence: 0,
        reasoning: "Rate limit exceeded",
        alternativeTypes: []
      };
    }
    
    const client = getOpenAIClient();
    if (!client) {
      return {
        documentType: 'other',
        confidence: 0,
        reasoning: "OpenAI API key not configured",
        alternativeTypes: []
      };
    }
    
    const prompt = readFileSync(join(process.cwd(), "guest-checkin", "prompts", "document-type-detection.txt"), "utf-8");
    
    log.info("Detecting document type", { orgId });
    
    const response = await client.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: "high"
              }
            }
          ]
        }
      ],
      max_tokens: 300,
      temperature: 0.1,
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }
    
    // Parse JSON response
    const detectionResult = JSON.parse(content) as DocumentTypeDetection;
    
    log.info("Document type detected", {
      orgId,
      detectedType: detectionResult.documentType,
      confidence: detectionResult.confidence,
      processingTime: Date.now() - startTime,
    });
    
    return detectionResult;
    
  } catch (error: any) {
    log.error("Document type detection failed", { 
      error: error.message, 
      orgId,
      processingTime: Date.now() - startTime,
    });
    
    // Return fallback detection
    return {
      documentType: 'other',
      confidence: 0,
      reasoning: `Detection failed: ${error.message}`,
      alternativeTypes: []
    };
  }
}

// Main extraction function with retry logic
export async function extractFromDocument(
  imageBase64: string,
  documentType: DocumentType,
  orgId: number = 1
): Promise<LLMExtractionResponse> {
  const startTime = Date.now();

  // Check rate limit
  if (!checkRateLimit(orgId)) {
    return {
      success: false,
      documentType,
      fields: {},
      overallConfidence: 0,
      processingTime: Date.now() - startTime,
      error: "Rate limit exceeded. Please try again in a minute.",
    };
  }

  log.info("Starting document extraction", { documentType, orgId });

  // Load appropriate prompt
  const systemPrompt = loadPrompt(documentType);

  let lastError: Error | null = null;
  let currentDelay = RETRY_CONFIG.initialDelayMs;

  // Retry logic with exponential backoff
  for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
    try {
      log.info("Extraction attempt", { attempt, documentType });

      const client = getOpenAIClient();
      if (!client) {
        throw new Error("OpenAI API key not configured. Set OpenAIAPIKey in Encore secrets.");
      }

      // Call OpenAI API with timeout
      const response = await Promise.race([
        client.chat.completions.create({
          model: OPENAI_MODEL,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: systemPrompt,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/jpeg;base64,${imageBase64}`,
                  },
                },
              ],
            },
          ],
          max_tokens: MAX_TOKENS,
          temperature: 0.1, // Low temperature for consistent extraction
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Request timeout after 30 seconds")), TIMEOUT_MS)
        ),
      ]) as OpenAI.Chat.Completions.ChatCompletion;

      // Parse response
      if (!response.choices || response.choices.length === 0) {
        throw new Error("No response from OpenAI API");
      }

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error("Empty content in OpenAI response");
      }

      // Parse extracted fields
      const fields = parseExtractionResponse(content, documentType);
      const overallConfidence = calculateOverallConfidence(fields);
      const processingTime = Date.now() - startTime;

      log.info("Extraction successful", {
        documentType,
        overallConfidence,
        processingTime,
        fieldCount: Object.keys(fields).length,
      });

      return {
        success: true,
        documentType,
        fields,
        overallConfidence,
        processingTime,
      };
    } catch (error: any) {
      lastError = error;
      
      log.warn("Extraction attempt failed", {
        attempt,
        documentType,
        error: error.message,
      });

      // Check if this is a rate limit error
      const isRateLimit = 
        error.message?.includes("rate_limit") ||
        error.message?.includes("429") ||
        error.status === 429;

      // Check if this is a timeout error
      const isTimeout = error.message?.includes("timeout");

      // Don't retry on certain errors
      const shouldNotRetry = 
        error.message?.includes("invalid_api_key") ||
        error.message?.includes("authentication") ||
        error.status === 401;

      if (shouldNotRetry) {
        break; // Exit retry loop immediately
      }

      // If not last attempt, wait before retrying
      if (attempt < RETRY_CONFIG.maxAttempts) {
        const waitTime = isRateLimit 
          ? RETRY_CONFIG.maxDelayMs // Wait longer for rate limits
          : Math.min(currentDelay, RETRY_CONFIG.maxDelayMs);
        
        log.info("Waiting before retry", { waitTime, attempt });
        await delay(waitTime);
        currentDelay *= RETRY_CONFIG.backoffMultiplier;
      }
    }
  }

  // All retries failed
  const processingTime = Date.now() - startTime;
  
  log.error("Extraction failed after all retries", {
    documentType,
    attempts: RETRY_CONFIG.maxAttempts,
    lastError: lastError?.message,
  });

  return {
    success: false,
    documentType,
    fields: {},
    overallConfidence: 0,
    processingTime,
    error: `Failed to extract document data after ${RETRY_CONFIG.maxAttempts} attempts: ${lastError?.message}`,
  };
}

// Retry extraction for a previously failed document (by document ID)
export async function retryExtraction(
  documentId: number,
  imageBase64: string,
  documentType: DocumentType,
  orgId: number
): Promise<LLMExtractionResponse> {
  log.info("Retrying extraction for document", { documentId, documentType });
  
  // Same logic as extractFromDocument
  return extractFromDocument(imageBase64, documentType, orgId);
}

// Batch extraction for multiple documents
export async function extractBatch(
  documents: Array<{
    id: number;
    imageBase64: string;
    documentType: DocumentType;
  }>,
  orgId: number
): Promise<Array<LLMExtractionResponse & { documentId: number }>> {
  log.info("Starting batch extraction", { count: documents.length, orgId });

  const results: Array<LLMExtractionResponse & { documentId: number }> = [];

  // Process sequentially to respect rate limits
  for (const doc of documents) {
    const result = await extractFromDocument(doc.imageBase64, doc.documentType, orgId);
    results.push({
      ...result,
      documentId: doc.id,
    });

    // Small delay between batch items
    await delay(500);
  }

  log.info("Batch extraction complete", {
    total: results.length,
    successful: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
  });

  return results;
}

// Helper to format Aadhaar number with spaces
export function formatAadhaarNumber(number: string): string {
  const cleaned = number.replace(/\s/g, "");
  if (cleaned.length === 12) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 8)} ${cleaned.slice(8, 12)}`;
  }
  return number;
}

// Helper to validate PAN format
export function validatePANFormat(pan: string): boolean {
  return /^[A-Z]{5}\d{4}[A-Z]$/.test(pan);
}

// Helper to parse date from various formats
export function parseDate(dateString: string): string | null {
  // Try YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString;
  }

  // Try DD/MM/YYYY format (common in Indian documents)
  const ddmmyyyyMatch = dateString.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddmmyyyyMatch) {
    const [, day, month, year] = ddmmyyyyMatch;
    return `${year}-${month}-${day}`;
  }

  // Try DD-MM-YYYY format
  const dashedMatch = dateString.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dashedMatch) {
    const [, day, month, year] = dashedMatch;
    return `${year}-${month}-${day}`;
  }

  // Try MM/DD/YYYY format (US format)
  const mmddyyyyMatch = dateString.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (mmddyyyyMatch) {
    const [, month, day, year] = mmddyyyyMatch;
    return `${year}-${month}-${day}`;
  }

  log.warn("Unable to parse date format", { dateString });
  return null;
}

// Get extraction statistics
export function getExtractionStats(): {
  totalRequests: number;
  rateLimitStates: Array<{ orgId: number; requestCount: number; remainingQuota: number }>;
} {
  const stats: Array<{ orgId: number; requestCount: number; remainingQuota: number }> = [];

  rateLimitMap.forEach((state, orgId) => {
    const now = Date.now();
    const isWindowActive = now - state.windowStart < state.windowDurationMs;
    
    stats.push({
      orgId,
      requestCount: isWindowActive ? state.requestCount : 0,
      remainingQuota: isWindowActive ? state.limit - state.requestCount : state.limit,
    });
  });

  return {
    totalRequests: stats.reduce((sum, s) => sum + s.requestCount, 0),
    rateLimitStates: stats,
  };
}

// Reset rate limit for an organization (admin function)
export function resetRateLimit(orgId: number): void {
  rateLimitMap.delete(orgId);
  log.info("Rate limit reset", { orgId });
}


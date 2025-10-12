# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-10-10-guest-document-llm-extraction/spec.md

## Technical Requirements

### 1. LLM Integration for Document OCR

**OpenAI GPT-4 Vision API Integration:**

- **Model**: GPT-4 Vision (`gpt-4-vision-preview`)
- **Input**: Base64-encoded image of ID document
- **Output**: Structured JSON with extracted fields and confidence scores
- **Prompt Engineering**:
  - Provide document type context (Aadhaar, Passport, PAN, Visa)
  - Request specific field extraction based on document type
  - Request confidence scores (0-100) for each extracted field
  - Handle multiple languages (English, Hindi for Aadhaar)

**Field Extraction Mapping:**

*For Indian Aadhaar Card:*
```json
{
  "documentType": "aadhaar",
  "fields": {
    "fullName": { "value": "string", "confidence": 95 },
    "aadharNumber": { "value": "string", "confidence": 98 },
    "dateOfBirth": { "value": "YYYY-MM-DD", "confidence": 90 },
    "address": { "value": "string", "confidence": 85 },
    "gender": { "value": "Male|Female|Other", "confidence": 95 }
  }
}
```

*For Passport:*
```json
{
  "documentType": "passport",
  "fields": {
    "fullName": { "value": "string", "confidence": 95 },
    "passportNumber": { "value": "string", "confidence": 98 },
    "dateOfBirth": { "value": "YYYY-MM-DD", "confidence": 95 },
    "nationality": { "value": "string", "confidence": 98 },
    "expiryDate": { "value": "YYYY-MM-DD", "confidence": 90 }
  }
}
```

*For PAN Card:*
```json
{
  "documentType": "pan",
  "fields": {
    "fullName": { "value": "string", "confidence": 95 },
    "panNumber": { "value": "string", "confidence": 98 },
    "dateOfBirth": { "value": "YYYY-MM-DD", "confidence": 90 }
  }
}
```

*For Visa:*
```json
{
  "documentType": "visa",
  "fields": {
    "fullName": { "value": "string", "confidence": 90 },
    "visaType": { "value": "string", "confidence": 95 },
    "visaNumber": { "value": "string", "confidence": 95 },
    "issueDate": { "value": "YYYY-MM-DD", "confidence": 90 },
    "expiryDate": { "value": "YYYY-MM-DD", "confidence": 90 },
    "country": { "value": "string", "confidence": 98 }
  }
}
```

**Error Handling:**
- Retry logic with exponential backoff (3 attempts)
- Fallback to manual entry if extraction confidence < 70% overall
- User notification of low-confidence fields requiring verification
- Timeout: 30 seconds per image
- Rate limiting: 10 requests/minute per organization

**LLM Service Module** (`backend/guest-checkin/llm-service.ts`):
```typescript
interface LLMExtractionRequest {
  imageBase64: string;
  documentType: 'aadhaar' | 'passport' | 'pan' | 'visa';
  side?: 'front' | 'back';
}

interface LLMExtractionResponse {
  success: boolean;
  documentType: string;
  fields: Record<string, FieldExtraction>;
  overallConfidence: number;
  processingTime: number;
  error?: string;
}

interface FieldExtraction {
  value: string;
  confidence: number;
  needsVerification: boolean;
}
```

---

### 2. File Upload & Storage System

**Upload Specifications:**

- **Supported Formats**: JPEG, PNG, WEBP, PDF
- **Max File Size**: 10MB per image
- **Max Images Per Guest**: 6 (Aadhaar front, Aadhaar back, PAN, Passport, Visa front, Visa back)
- **Image Processing**:
  - Auto-rotation based on EXIF data
  - Resize large images to max 2048x2048 to reduce storage
  - Generate thumbnail (300x300) for quick preview
  - Strip EXIF metadata except orientation for privacy
- **Storage Location**: `/backend/uploads/guest-documents/{orgId}/{guestCheckInId}/`
- **File Naming**: `{documentType}_{side}_{timestamp}_{uuid}.{ext}`
  - Example: `aadhaar_front_20251010120530_a1b2c3d4.jpg`

**Security Measures:**

- Files only accessible via authenticated API endpoints
- No direct filesystem access from frontend
- URL signing with 1-hour expiration for document viewing
- Encryption at rest using AES-256 (if required for compliance)
- Virus scanning on upload (ClamAV integration optional)

**Upload Flow:**

1. Frontend captures/selects image
2. Client-side validation (file type, size)
3. Convert to base64 and send to `/guest-checkin/documents/upload`
4. Backend validates, saves to disk, creates database record
5. Backend calls LLM service for text extraction
6. Backend returns: document ID, file URL, extracted data, confidence scores
7. Frontend displays extracted data with confidence indicators
8. User reviews and confirms/edits data

---

### 3. Audit Logging System

**Audit Log Requirements:**

- **What to Log**: All CRUD operations on guest_checkins, all document views/downloads, all audit log queries
- **Log Retention**: Indefinite (never delete, or 7 years for compliance)
- **Performance**: Non-blocking async logging (don't slow down operations)
- **Storage**: Separate `guest_audit_logs` table with indexes on common query patterns

**Logged Actions:**

| Action | Trigger | Logged Data |
|--------|---------|-------------|
| `create_checkin` | New guest check-in | Guest ID, all form data |
| `update_checkin` | Update guest info | Guest ID, changed fields (before/after) |
| `checkout_guest` | Guest checkout | Guest ID, checkout date |
| `view_guest_details` | Open guest detail page | Guest ID |
| `view_documents` | Open document viewer | Guest ID, document IDs |
| `download_document` | Download document | Guest ID, document ID |
| `delete_document` | Delete document | Guest ID, document ID, reason |
| `upload_document` | Upload new document | Guest ID, document type |
| `query_audit_logs` | View audit log page | Search filters used |

**Audit Log Entry Structure:**

```typescript
interface AuditLogEntry {
  id: number;
  orgId: number;
  userId: number;
  userEmail: string;
  userRole: string;
  actionType: string;
  resourceType: 'guest_checkin' | 'guest_document';
  resourceId: number;
  guestCheckInId: number;
  guestName: string;
  ipAddress: string;
  userAgent: string;
  actionDetails: Record<string, any>; // JSON field
  timestamp: Date;
}
```

**Audit Log Middleware:**

Create reusable middleware that wraps API endpoints:

```typescript
// backend/guest-checkin/audit-middleware.ts
export const auditLog = (actionType: string) => {
  return async (handler: Function) => {
    return async (...args: any[]) => {
      const authData = auth.data()!;
      const startTime = Date.now();
      
      try {
        const result = await handler(...args);
        
        // Log successful action
        await auditDB.exec`
          INSERT INTO guest_audit_logs (...)
          VALUES (...)
        `;
        
        return result;
      } catch (error) {
        // Log failed action attempt
        await auditDB.exec`
          INSERT INTO guest_audit_logs (...)
          VALUES (..., error: ${error.message})
        `;
        throw error;
      }
    };
  };
};
```

**Usage in API Endpoints:**

```typescript
export const getCheckIn = auditLog('view_guest_details')(
  api({ expose: true, method: "GET", path: "/guest-checkin/:id", auth },
  async ({ id }) => {
    // ... existing logic
  })
);
```

---

### 4. UI/UX Specifications

**Document Upload Component Enhancements:**

- **Camera Integration**: Use browser `navigator.mediaDevices.getUserMedia()` for live camera capture
- **Drag-and-Drop Zone**: Visual feedback with border highlight on dragover
- **Upload Progress**: Real-time progress bar (0-100%) with cancel option
- **Multi-Image Upload**: Display all uploaded documents as thumbnails with delete option
- **Confidence Indicators**: 
  - Green badge (≥90%): "High Confidence"
  - Yellow badge (70-89%): "Please Verify"
  - Red badge (<70%): "Manual Entry Recommended"
- **Auto-fill Animation**: Smooth transition when fields populate with extracted data

**Document Viewer Modal:**

```tsx
<Dialog>
  <DialogContent className="max-w-4xl max-h-[90vh]">
    <DialogHeader>
      <DialogTitle>Guest Documents - {guestName}</DialogTitle>
    </DialogHeader>
    
    <Tabs defaultValue="aadhaar-front">
      <TabsList>
        {documents.map(doc => (
          <TabsTrigger value={doc.id}>{doc.type}</TabsTrigger>
        ))}
      </TabsList>
      
      {documents.map(doc => (
        <TabsContent value={doc.id}>
          <div className="relative">
            <img src={doc.signedUrl} alt={doc.type} />
            <div className="absolute top-4 right-4 flex gap-2">
              <Button size="sm" onClick={handleZoomIn}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button size="sm" onClick={handleRotate}>
                <RotateCw className="h-4 w-4" />
              </Button>
              <Button size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="mt-4">
            <h4>Extracted Information</h4>
            <dl className="grid grid-cols-2 gap-2">
              {doc.extractedData.fields.map(field => (
                <div>
                  <dt className="font-medium">{field.label}</dt>
                  <dd className="flex items-center gap-2">
                    {field.value}
                    <ConfidenceBadge score={field.confidence} />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </TabsContent>
      ))}
    </Tabs>
  </DialogContent>
</Dialog>
```

**Audit Log Viewer Component:**

```tsx
<Card>
  <CardHeader>
    <CardTitle>Audit Trail</CardTitle>
    <CardDescription>Complete history of actions on guest records</CardDescription>
  </CardHeader>
  
  <CardContent>
    {/* Filters */}
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <DateRangePicker label="Date Range" />
      <Select label="Action Type" options={actionTypes} />
      <Select label="User" options={users} />
      <Input label="Guest Name" placeholder="Search..." />
    </div>
    
    {/* Table */}
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Timestamp</TableHead>
          <TableHead>User</TableHead>
          <TableHead>Action</TableHead>
          <TableHead>Guest</TableHead>
          <TableHead>Details</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {auditLogs.map(log => (
          <TableRow key={log.id}>
            <TableCell>{formatDateTime(log.timestamp)}</TableCell>
            <TableCell>
              <div>
                <p className="font-medium">{log.userEmail}</p>
                <Badge variant="outline">{log.userRole}</Badge>
              </div>
            </TableCell>
            <TableCell>
              <Badge variant={getActionVariant(log.actionType)}>
                {log.actionType}
              </Badge>
            </TableCell>
            <TableCell>{log.guestName}</TableCell>
            <TableCell>
              <Button variant="ghost" size="sm" onClick={() => viewDetails(log)}>
                <Eye className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    
    {/* Export Button */}
    <div className="mt-4">
      <Button variant="outline" onClick={exportToCSV}>
        <Download className="h-4 w-4 mr-2" />
        Export to CSV
      </Button>
    </div>
  </CardContent>
</Card>
```

---

### 5. Performance Optimizations

**Image Upload:**
- Client-side image compression before upload (reduce quality to 85%, max dimension 2048px)
- Show upload progress to prevent multiple submissions
- Queue multiple uploads to process sequentially

**LLM API Calls:**
- Cache extraction results by image hash (avoid re-processing same image)
- Background job for processing (don't block check-in completion)
- Retry failed extractions after 5 minutes automatically

**Audit Logging:**
- Async/non-blocking writes using message queue (optional)
- Batch inserts every 5 seconds if high volume
- Index on timestamp, userId, actionType, guestCheckInId

**Document Viewer:**
- Lazy load images (only load when tab is active)
- Generate and serve thumbnails instead of full images for gallery view
- Implement virtual scrolling if >20 documents

---

### 6. Security & Compliance

**Data Protection:**
- All document images encrypted at rest (optional, configurable)
- TLS 1.3 for all API communication
- Document URLs signed with JWT, 1-hour expiration
- No document data in frontend localStorage (only in-memory)

**Access Control:**
- Only admin and manager roles can view/upload documents
- Staff and regular users cannot access document endpoints
- Failed access attempts logged in audit trail
- Rate limiting: 100 requests/minute per user for document endpoints

**GDPR Compliance:**
- Audit logs include data for GDPR Article 15 (right of access)
- Document deletion capability for GDPR Article 17 (right to erasure)
- Provide data export functionality for guest records
- Retain audit logs even after guest data deletion (anonymize guest name)

**Privacy:**
- Strip EXIF GPS data from uploaded images
- Don't log full document content in audit logs (only metadata)
- Redact sensitive fields in exported audit logs (e.g., full document numbers)

---

### 7. Error Handling & Edge Cases

**LLM Extraction Failures:**
- If OpenAI API is down: Queue for retry, allow manual entry
- If extraction confidence too low: Highlight fields, request manual verification
- If image quality poor: Show error message, suggest re-uploading

**File Upload Failures:**
- Network error: Retry with exponential backoff (3 attempts)
- File too large: Show error before upload attempt
- Invalid file type: Client-side validation prevents upload
- Disk space full: Log error, notify admin via email

**Audit Log Failures:**
- If logging fails, don't block main operation (just log error)
- Queue failed logs for retry
- Alert admin if audit logging fails repeatedly

**Document Viewer Issues:**
- If image fails to load: Show placeholder with "Image unavailable"
- If signed URL expired: Auto-refresh URL
- If document deleted: Show "Document no longer available"

---

## External Dependencies

### 1. **OpenAI SDK** - LLM-powered document text extraction

```json
{
  "name": "openai",
  "version": "^4.20.0",
  "type": "npm"
}
```

**Justification**: OpenAI's GPT-4 Vision model provides state-of-the-art OCR capabilities with context understanding, significantly more accurate than traditional OCR libraries (Tesseract) for complex documents like Indian Aadhaar cards with mixed English/Hindi text. The SDK provides TypeScript support and handles API authentication, retries, and error handling.

**Alternative Considered**: Google Cloud Vision API - rejected due to higher cost and less flexible output formatting.

**Configuration Required**:
```bash
# Add to encore.dev secrets
OpenAIAPIKey=sk-proj-xxxxxxxxxxxxx
```

**Usage Example**:
```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OpenAIAPIKey,
});

const response = await openai.chat.completions.create({
  model: "gpt-4-vision-preview",
  messages: [
    {
      role: "user",
      content: [
        { 
          type: "text", 
          text: "Extract all text from this Aadhaar card and return as JSON with fields: fullName, aadharNumber, dateOfBirth, address, gender. Include confidence score for each field." 
        },
        {
          type: "image_url",
          image_url: {
            url: `data:image/jpeg;base64,${imageBase64}`
          }
        }
      ]
    }
  ],
  max_tokens: 500
});
```

---

### 2. **Sharp** - High-performance image processing (resize, rotate, thumbnail generation)

```json
{
  "name": "sharp",
  "version": "^0.33.0",
  "type": "npm"
}
```

**Justification**: Sharp is 4-10x faster than ImageMagick or Canvas for image processing operations. Written in C++ with Node.js bindings, it efficiently handles image resizing, rotation, format conversion, and thumbnail generation. Essential for optimizing uploaded images before storage and creating thumbnails for document galleries.

**Alternative Considered**: Jimp (pure JavaScript) - rejected due to significantly slower performance on large images.

**Usage Example**:
```typescript
import sharp from 'sharp';

// Resize and compress uploaded image
const processedImage = await sharp(imageBuffer)
  .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
  .rotate() // Auto-rotate based on EXIF
  .jpeg({ quality: 85 })
  .toBuffer();

// Generate thumbnail
const thumbnail = await sharp(imageBuffer)
  .resize(300, 300, { fit: 'cover' })
  .jpeg({ quality: 80 })
  .toBuffer();
```

---

### 3. **UUID** - Generate unique filenames for document storage

```json
{
  "name": "uuid",
  "version": "^9.0.0",
  "type": "npm"
}
```

**Justification**: Generates RFC4122 compliant UUIDs (universally unique identifiers) for naming uploaded files, preventing filename collisions and adding security through obscurity. UUID v4 uses cryptographically strong random numbers.

**Alternative Considered**: Built-in `crypto.randomUUID()` (Node 16+) - equally good but explicit dependency makes version requirements clear.

**Usage Example**:
```typescript
import { v4 as uuidv4 } from 'uuid';

const uniqueFilename = `${documentType}_${side}_${timestamp}_${uuidv4()}.${ext}`;
// Result: aadhaar_front_20251010120530_a3f2b8c9-4d5e-4f6a-8b9c-1d2e3f4a5b6c.jpg
```

---

### 4. **jsonwebtoken** - Sign document URLs with expiring tokens

```json
{
  "name": "jsonwebtoken",
  "version": "^9.0.2",
  "type": "npm"
}
```

**Justification**: Create short-lived signed URLs for document access, preventing unauthorized access to guest documents. Documents are served via authenticated endpoints with JWT-signed URLs that expire after 1 hour, ensuring documents can't be accessed after the token expires.

**Alternative Considered**: HMAC signatures - JWT provides richer payload (expiry, user ID) and standardized validation.

**Usage Example**:
```typescript
import jwt from 'jsonwebtoken';

// Generate signed URL
const token = jwt.sign(
  { 
    documentId: doc.id, 
    userId: authData.userID,
    orgId: authData.orgId 
  },
  process.env.JWTSecret,
  { expiresIn: '1h' }
);

const signedUrl = `${API_CONFIG.BASE_URL}/guest-checkin/documents/${doc.id}/view?token=${token}`;
```

---

## Testing Requirements

### Unit Tests
- LLM extraction service with mocked OpenAI responses
- Audit logging middleware with mocked database
- Document upload validation (file type, size limits)
- JWT URL signing and verification

### Integration Tests
- End-to-end document upload → LLM extraction → form auto-fill
- Audit log creation on all API endpoints
- Document viewer with signed URLs
- Role-based access control for document endpoints

### Manual Testing Checklist
- [ ] Upload Aadhaar front/back and verify auto-fill
- [ ] Upload passport and verify nationality extraction
- [ ] Upload low-quality image and verify error handling
- [ ] View documents as admin and verify audit log entry
- [ ] Attempt document access as regular user (should fail)
- [ ] Export audit logs to CSV
- [ ] Verify signed URL expires after 1 hour
- [ ] Test with large image (9MB) and verify compression
- [ ] Test with invalid file type and verify rejection
- [ ] Test concurrent uploads (10 simultaneous)


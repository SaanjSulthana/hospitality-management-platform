# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-10-08-guest-check-in/spec.md

## Endpoints

### POST /guest-checkin/create

**Purpose:** Create a new guest check-in record

**Authentication:** Required (JWT Bearer token)

**Authorization:** Any authenticated user can create check-ins

**Request Body:**
```typescript
{
  propertyId: number;
  guestType: 'indian' | 'foreign';
  fullName: string;
  email: string;
  phone: string;
  address: string;
  
  // Indian guests
  aadharNumber?: string;  // Required if guestType = 'indian'
  panNumber?: string;
  
  // Foreign guests
  passportNumber?: string;  // Required if guestType = 'foreign'
  country?: string;
  visaType?: string;
  visaExpiryDate?: string;
  
  // Booking details
  expectedCheckoutDate?: string;
  roomNumber?: string;
  numberOfGuests?: number;
}
```

**Response:**
```typescript
{
  id: number;
  message: string;
  checkInDate: string;
}
```

**Errors:**
- 401: Unauthenticated
- 400: Invalid input (missing required fields, invalid email/phone format)
- 404: Property not found
- 500: Internal server error

---

### GET /guest-checkin/list

**Purpose:** List all guest check-ins with filtering

**Authentication:** Required

**Authorization:** Admin/Manager/Owner can view all, regular users can only view their own

**Query Parameters:**
- `propertyId?: number` - Filter by property
- `status?: string` - Filter by status (checked_in, checked_out, cancelled)
- `guestType?: string` - Filter by guest type (indian, foreign)
- `startDate?: string` - Filter check-ins from this date
- `endDate?: string` - Filter check-ins until this date
- `search?: string` - Search by name, email, or phone
- `limit?: number` - Pagination limit (default: 50)
- `offset?: number` - Pagination offset (default: 0)

**Response:**
```typescript
{
  checkins: Array<{
    id: number;
    orgId: number;
    propertyId: number;
    propertyName: string;
    guestType: 'indian' | 'foreign';
    fullName: string;
    email: string;
    phone: string;
    address: string;
    aadharNumber?: string;
    panNumber?: string;
    passportNumber?: string;
    country?: string;
    visaType?: string;
    visaExpiryDate?: string;
    checkInDate: string;
    expectedCheckoutDate?: string;
    actualCheckoutDate?: string;
    roomNumber?: string;
    numberOfGuests: number;
    status: string;
    createdByUserId: number;
    createdAt: string;
    updatedAt: string;
  }>;
  total: number;
  limit: number;
  offset: number;
}
```

**Errors:**
- 401: Unauthenticated
- 403: Permission denied
- 500: Internal server error

---

### GET /guest-checkin/:id

**Purpose:** Get details of a specific guest check-in

**Authentication:** Required

**Authorization:** Admin/Manager/Owner can view all, regular users can only view their own

**Parameters:**
- `id: number` - Check-in ID

**Response:**
```typescript
{
  id: number;
  orgId: number;
  propertyId: number;
  propertyName: string;
  guestType: 'indian' | 'foreign';
  fullName: string;
  email: string;
  phone: string;
  address: string;
  aadharNumber?: string;
  panNumber?: string;
  passportNumber?: string;
  country?: string;
  visaType?: string;
  visaExpiryDate?: string;
  checkInDate: string;
  expectedCheckoutDate?: string;
  actualCheckoutDate?: string;
  roomNumber?: string;
  numberOfGuests: number;
  status: string;
  createdByUserId: number;
  createdAt: string;
  updatedAt: string;
}
```

**Errors:**
- 401: Unauthenticated
- 403: Permission denied
- 404: Check-in not found
- 500: Internal server error

---

### PUT /guest-checkin/:id/update

**Purpose:** Update guest check-in details

**Authentication:** Required

**Authorization:** Admin/Manager/Owner can update all, regular users can update their own

**Parameters:**
- `id: number` - Check-in ID

**Request Body:**
```typescript
{
  fullName?: string;
  email?: string;
  phone?: string;
  address?: string;
  roomNumber?: string;
  numberOfGuests?: number;
  expectedCheckoutDate?: string;
}
```

**Response:**
```typescript
{
  message: string;
  updatedAt: string;
}
```

**Errors:**
- 401: Unauthenticated
- 403: Permission denied
- 404: Check-in not found
- 400: Invalid input
- 500: Internal server error

---

### POST /guest-checkin/:id/checkout

**Purpose:** Mark a guest as checked out

**Authentication:** Required

**Authorization:** Admin/Manager/Owner only

**Parameters:**
- `id: number` - Check-in ID

**Request Body:**
```typescript
{
  actualCheckoutDate?: string;  // Defaults to now if not provided
}
```

**Response:**
```typescript
{
  message: string;
  actualCheckoutDate: string;
}
```

**Errors:**
- 401: Unauthenticated
- 403: Permission denied
- 404: Check-in not found
- 400: Already checked out
- 500: Internal server error

---

### DELETE /guest-checkin/:id

**Purpose:** Delete (cancel) a guest check-in

**Authentication:** Required

**Authorization:** Admin/Owner only

**Parameters:**
- `id: number` - Check-in ID

**Response:**
```typescript
{
  message: string;
}
```

**Errors:**
- 401: Unauthenticated
- 403: Permission denied
- 404: Check-in not found
- 500: Internal server error

---

### GET /guest-checkin/stats

**Purpose:** Get check-in statistics for dashboard

**Authentication:** Required

**Authorization:** Admin/Manager/Owner only

**Query Parameters:**
- `propertyId?: number` - Filter by property
- `startDate?: string` - Stats from this date
- `endDate?: string` - Stats until this date

**Response:**
```typescript
{
  totalCheckins: number;
  currentlyCheckedIn: number;
  checkedOut: number;
  indianGuests: number;
  foreignGuests: number;
  byProperty: Array<{
    propertyId: number;
    propertyName: string;
    count: number;
  }>;
}
```

**Errors:**
- 401: Unauthenticated
- 403: Permission denied
- 500: Internal server error

## Implementation Notes

### Authentication
All endpoints use the existing `auth` middleware from `backend/auth/middleware.ts` for JWT token verification.

### Authorization
Role-based access control implemented using the `requireRole` helper:
- Create check-in: All authenticated users
- List/View check-ins: Admin/Manager/Owner see all, others see only their own
- Update check-in: Admin/Manager/Owner update all, others update only their own
- Checkout: Admin/Manager/Owner only
- Delete: Admin/Owner only
- Stats: Admin/Manager/Owner only

### Data Validation
- Email format validation using regex
- Phone number format validation
- Aadhar number: 12 digits
- PAN number: 10 alphanumeric characters
- Passport number: Alphanumeric, max 50 characters
- Date validation for check-in and checkout dates

### Error Handling
Consistent error responses using Encore's `APIError` class with appropriate status codes and descriptive messages.

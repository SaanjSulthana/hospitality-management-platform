# 🚀 Hospitality Management Platform - Complete API Reference

**Version:** 1.0  
**Last Updated:** October 8, 2025  
**Base URL:** `http://localhost:4000`  
**Timezone:** IST (Asia/Kolkata) - 24-hour format  
**Authentication:** Bearer JWT Token

---

## 📋 **Quick Navigation**

- [Getting Started](#getting-started)
- [1. Authentication Service](#1-authentication-service-auth)
- [2. Properties Service](#2-properties-service-properties)
- [3. Finance Service](#3-finance-service-finance)
- [4. Reports Service](#4-reports-service-reports)
- [5. Staff Service](#5-staff-service-staff)
- [6. Users Service](#6-users-service-users)
- [7. Tasks Service](#7-tasks-service-tasks)
- [8. Organizations Service](#8-organizations-service-orgs)
- [9. Uploads Service](#9-uploads-service-uploads)
- [10. Branding Service](#10-branding-service-branding)
- [11. Analytics Service](#11-analytics-service-analytics)
- [Testing Scripts](#testing-scripts)
- [12.Guest Check-in Service]
---

## **Getting Started**

### **Prerequisites:**
```bash
# Ensure backend is running
cd backend
encore run

# Backend should be accessible at http://localhost:4000
```

### **Authentication Flow:**

```bash
# Step 1: Login to get access token
curl -X POST "http://localhost:4000/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "shreya@gmail.com",
    "password": "123456789"
  }' | python3 -c "import sys, json; print(json.load(sys.stdin)['accessToken'])" > /tmp/token.txt

# Step 2: Use token in all subsequent requests
TOKEN=$(cat /tmp/token.txt)
curl -X GET "http://localhost:4000/auth/me" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 1. **Authentication Service** (`/auth`)

### **1.1 Login** ✅ TESTED
```bash
POST /auth/login
```

**Request:**
```bash
curl -X POST "http://localhost:4000/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "shreya@gmail.com",
    "password": "123456789"
  }'
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 2,
    "email": "shreya@gmail.com",
    "displayName": "Shreya",
    "role": "ADMIN",
    "orgId": 2
  }
}
```

---

### **1.2 Signup**
```bash
POST /auth/signup
```

**Request:**
```bash
curl -X POST "http://localhost:4000/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "SecurePass123!",
    "displayName": "New User",
    "orgName": "My Hotel Group"
  }'
```

---

### **1.3 Get Current User** ✅ TESTED
```bash
GET /auth/me
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X GET "http://localhost:4000/auth/me" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "user": {
    "userID": "2",
    "email": "shreya@gmail.com",
    "displayName": "Shreya",
    "role": "ADMIN",
    "orgId": 2
  },
  "permissions": [
    "org:manage",
    "users:manage",
    "properties:manage",
    "analytics:view_all",
    "branding:manage",
    "finance:manage",
    "managers:create"
  ]
}
```

---

### **1.4 Refresh Token**
```bash
POST /auth/refresh
```

**Request:**
```bash
REFRESH_TOKEN="your_refresh_token"
curl -X POST "http://localhost:4000/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}"
```

---

### **1.5 Logout**
```bash
POST /auth/logout
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X POST "http://localhost:4000/auth/logout" \
  -H "Authorization: Bearer $TOKEN"
```

---

### **1.6 Forgot Password**
```bash
POST /auth/forgot-password
```

**Request:**
```bash
curl -X POST "http://localhost:4000/auth/forgot-password" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "shreya@gmail.com"
  }'
```

---

### **1.7 Reset Password**
```bash
POST /auth/reset-password
```

**Request:**
```bash
curl -X POST "http://localhost:4000/auth/reset-password" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "reset_token_from_email",
    "newPassword": "NewSecurePass123!"
  }'
```

---

## 2. **Properties Service** (`/properties`)

### **2.1 List All Properties** ✅ TESTED
```bash
GET /properties
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X GET "http://localhost:4000/properties" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "properties": [
    {
      "id": 1,
      "name": "test1",
      "type": "hotel",
      "status": "active",
      "addressJson": {
        "street": "test address",
        "city": "panaji",
        "state": "Goa",
        "country": "India",
        "zipCode": "12345"
      },
      "capacityJson": {
        "totalRooms": 3,
        "totalBeds": 10
      },
      "amenitiesJson": {
        "amenities": []
      },
      "createdAt": "2025-10-02T05:14:52.944Z"
    },
    {
      "id": 3,
      "name": "HostelExp Munroe",
      "type": "hostel",
      "status": "active",
      "addressJson": {},
      "capacityJson": {},
      "amenitiesJson": {"amenities": []},
      "createdAt": "2025-10-05T06:56:12.778Z"
    }
  ]
}
```

---

### **2.2 Create Property**
```bash
POST /properties/create
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X POST "http://localhost:4000/properties/create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Luxury Resort Mumbai",
    "type": "resort",
    "addressJson": {
      "street": "Marine Drive",
      "city": "Mumbai",
      "state": "Maharashtra",
      "country": "India",
      "zipCode": "400020"
    },
    "capacityJson": {
      "totalRooms": 50,
      "totalBeds": 100
    },
    "amenitiesJson": {
      "amenities": ["wifi", "pool", "gym", "spa"]
    },
    "status": "active"
  }'
```

---

### **2.3 Update Property**
```bash
PUT /properties/update
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X PUT "http://localhost:4000/properties/update" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": 1,
    "name": "Updated Property Name",
    "status": "active",
    "capacityJson": {
      "totalRooms": 5,
      "totalBeds": 15
    }
  }'
```

---

### **2.4 Delete Property**
```bash
DELETE /properties/delete
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X DELETE "http://localhost:4000/properties/delete" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": 5
  }'
```

---

### **2.5 Get Property Occupancy**
```bash
GET /properties/occupancy
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X GET "http://localhost:4000/properties/occupancy?propertyId=1" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 3. **Finance Service** (`/finance`)

### **📥 Revenue Endpoints:**

#### **3.1 List Revenues** ✅ TESTED
```bash
GET /finance/revenues
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)

# List all revenues
curl -X GET "http://localhost:4000/finance/revenues" \
  -H "Authorization: Bearer $TOKEN"

# Filter by property
curl -X GET "http://localhost:4000/finance/revenues?propertyId=1" \
  -H "Authorization: Bearer $TOKEN"

# Filter by date range
curl -X GET "http://localhost:4000/finance/revenues?propertyId=1&startDate=2025-10-01&endDate=2025-10-31" \
  -H "Authorization: Bearer $TOKEN"

# Filter by status and payment mode
curl -X GET "http://localhost:4000/finance/revenues?status=approved&paymentMode=cash" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "revenues": [
    {
      "id": 1,
      "propertyId": 1,
      "propertyName": "test1",
      "amountCents": 220000,
      "source": "room",
      "description": "Room booking revenue",
      "paymentMode": "cash",
      "bankReference": null,
      "occurredAt": "2025-10-05T13:00:00.000Z",
      "status": "approved",
      "createdByUserId": 2,
      "createdByName": "Shreya",
      "createdAt": "2025-10-05T13:00:00.000Z",
      "receiptFileId": null
    }
  ]
}
```

---

#### **3.2 Add Revenue** ✅ TESTED
```bash
POST /finance/revenues
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)

# Add cash revenue
curl -X POST "http://localhost:4000/finance/revenues" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "propertyId": 1,
    "amountCents": 500000,
    "paymentMode": "cash",
    "description": "Room booking payment",
    "source": "room",
    "occurredAt": "2025-10-08T10:30:00.000Z"
  }'

# Add bank/UPI revenue
curl -X POST "http://localhost:4000/finance/revenues" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "propertyId": 1,
    "amountCents": 750000,
    "paymentMode": "bank",
    "bankReference": "UPI-REF-123456",
    "description": "Online booking payment",
    "source": "addon",
    "occurredAt": "2025-10-08T14:30:00.000Z"
  }'
```

**Response:**
```json
{
  "id": 456,
  "success": true
}
```

---

#### **3.3 Update Revenue** ✅ TESTED
```bash
PATCH /finance/revenues/{id}
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
REVENUE_ID=456

curl -X PATCH "http://localhost:4000/finance/revenues/${REVENUE_ID}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amountCents": 550000,
    "description": "Updated booking payment",
    "paymentMode": "bank",
    "bankReference": "UPI-REF-UPDATED"
  }'
```

---

#### **3.4 Delete Revenue** ✅ TESTED
```bash
DELETE /finance/revenues/{id}
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
REVENUE_ID=456

curl -X DELETE "http://localhost:4000/finance/revenues/${REVENUE_ID}" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "deleted": true,
  "message": "Revenue deleted successfully"
}
```

---

#### **3.5 Approve/Reject Revenue** ✅ TESTED (Admin Only)
```bash
PATCH /finance/revenues/{id}/approve
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
REVENUE_ID=456

# Approve
curl -X PATCH "http://localhost:4000/finance/revenues/${REVENUE_ID}/approve" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": 456,
    "approved": true
  }'

# Reject
curl -X PATCH "http://localhost:4000/finance/revenues/${REVENUE_ID}/approve" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": 456,
    "approved": false
  }'
```

---

### **📤 Expense Endpoints:**

#### **3.6 List Expenses** ✅ TESTED
```bash
GET /finance/expenses
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)

# List all expenses
curl -X GET "http://localhost:4000/finance/expenses" \
  -H "Authorization: Bearer $TOKEN"

# Filter by property and date
curl -X GET "http://localhost:4000/finance/expenses?propertyId=1&startDate=2025-10-01&endDate=2025-10-31" \
  -H "Authorization: Bearer $TOKEN"

# Filter by category and payment mode
curl -X GET "http://localhost:4000/finance/expenses?category=maintenance&paymentMode=cash" \
  -H "Authorization: Bearer $TOKEN"
```

---

#### **3.7 Add Expense** ✅ TESTED
```bash
POST /finance/expenses
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)

# Add cash expense
curl -X POST "http://localhost:4000/finance/expenses" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "propertyId": 1,
    "amountCents": 150000,
    "paymentMode": "cash",
    "description": "Monthly maintenance work",
    "category": "maintenance",
    "expenseDate": "2025-10-08"
  }'

# Add bank expense
curl -X POST "http://localhost:4000/finance/expenses" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "propertyId": 1,
    "amountCents": 200000,
    "paymentMode": "bank",
    "bankReference": "NEFT-789012",
    "description": "Utility bills payment",
    "category": "utilities",
    "expenseDate": "2025-10-08"
  }'
```

**Categories:** `supplies`, `maintenance`, `utilities`, `marketing`, `staff`, `insurance`, `other`

---

#### **3.8 Update Expense** ✅ TESTED
```bash
PATCH /finance/expenses/{id}
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
EXPENSE_ID=789

curl -X PATCH "http://localhost:4000/finance/expenses/${EXPENSE_ID}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amountCents": 160000,
    "description": "Updated maintenance cost",
    "category": "maintenance"
  }'
```

---

#### **3.9 Delete Expense** ✅ TESTED
```bash
DELETE /finance/expenses/{id}
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
EXPENSE_ID=789

curl -X DELETE "http://localhost:4000/finance/expenses/${EXPENSE_ID}" \
  -H "Authorization: Bearer $TOKEN"
```

---

#### **3.10 Approve/Reject Expense** ✅ TESTED (Admin Only)
```bash
PATCH /finance/expenses/{id}/approve
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
EXPENSE_ID=789

# Approve
curl -X PATCH "http://localhost:4000/finance/expenses/${EXPENSE_ID}/approve" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": 789,
    "approved": true
  }'
```

---

### **📊 Finance Reports & Status:**

#### **3.11 Get Financial Summary**
```bash
GET /finance/summary
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X GET "http://localhost:4000/finance/summary?propertyId=1&startDate=2025-10-01&endDate=2025-10-31" \
  -H "Authorization: Bearer $TOKEN"
```

---

#### **3.12 Check Daily Approval Status** (Manager)
```bash
POST /finance/check-daily-approval
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X POST "http://localhost:4000/finance/check-daily-approval" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

#### **3.13 Get Pending Approvals** (Admin)
```bash
GET /finance/pending-approvals
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X GET "http://localhost:4000/finance/pending-approvals?date=2025-10-08" \
  -H "Authorization: Bearer $TOKEN"
```

---

### **⚡ Real-time Streaming & Telemetry**

Real-time endpoints deliver finance updates with sub-second latency using the leader/follower pattern described in `docs/NETWORKING_AND_REALTIME_IMPROVEMENTS.md`.

#### **3.14 Subscribe to Realtime Finance Events**
```bash
GET /finance/realtime/subscribe
```

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `lastEventId` | string | ISO timestamp of the latest event you received (optional) |
| `propertyId` | integer | Only receive events for a specific property (optional) |

**Behavior:**
- Uses long-polling (25 s timeout). Returns immediately when events are available, otherwise waits until new events arrive or timeout elapses.
- Responds with buffered events plus a new `lastEventId` so clients can resume without duplication.
- Requires Bearer token; scoped per org.

**Sample Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
LAST_EVENT_ID=$(date -Iseconds)

curl -X GET "http://localhost:4000/finance/realtime/subscribe?lastEventId=${LAST_EVENT_ID}" \
  -H "Authorization: Bearer $TOKEN"
```

**Sample Response:**
```json
{
  "events": [
    {
      "eventId": "2025-10-08T12:34:56.789Z",
      "type": "finance.revenue.created",
      "propertyId": 1,
      "payload": { "id": 456, "amountCents": 500000 },
      "timestamp": "2025-10-08T12:34:56.789Z"
    }
  ],
  "lastEventId": "2025-10-08T12:34:56.789Z"
}
```

#### **3.15 Realtime Buffer Metrics**
```bash
GET /finance/realtime/metrics
```

**Purpose:** Operational endpoint that exposes per-org buffer stats: queue sizes, published/delivered counts, drops, TTL, waiter caps.

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X GET "http://localhost:4000/finance/realtime/metrics" \
  -H "Authorization: Bearer $TOKEN"
```

**Sample Response:**
```json
{
  "buffers": [
    {
      "orgId": 2,
      "size": 3,
      "totalPublished": 125,
      "totalDelivered": 122,
      "totalDropped": 0,
      "maxBufferSize": 200,
      "eventTtlMs": 25000,
      "waiters": 1
    }
  ]
}
```

#### **Realtime Client Expectations**

- **Leader/Follower:** Only one tab per user session should hold the long-poll connection (“leader”). Use `BroadcastChannel('finance-events')` + localStorage/Web Locks to elect the leader; other tabs (“followers”) listen locally and avoid hitting the backend.
- **Backoff & Health:** If the subscribe request returns empty in <1.5 s, back off 2–5 s before retrying. Hidden/follower tabs should relaunch every 3–5 s at most.
- **Auth lifecycle:** Listen to the global `auth-control` channel; abort the long-poll immediately when a logout event fires, and resume only after fresh tokens exist.
- **Telemetry:** Sample 2% of client events (see `/telemetry/client` below) to capture `fast_empty`, `leader_acquired`, `leader_takeover`, and network errors.

#### **3.16 Client Telemetry Ingestion**
```bash
POST /telemetry/client
```

**Purpose:** Allows browsers to report sampled telemetry for realtime and auth events.

**Request Body:**
```json
{
  "type": "finance.fast_empty",
  "orgId": 2,
  "tabId": "tab-123",
  "elapsedMs": 240,
  "backoffMs": 3000,
  "isLeader": true,
  "timestamp": "2025-10-08T12:35:10.123Z",
  "metadata": {
    "status": 200,
    "reason": "no_events"
  }
}
```

**cURL Example:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X POST "http://localhost:4000/telemetry/client" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
        "type": "finance.leader_acquired",
        "orgId": 2,
        "tabId": "tab-abc",
        "timestamp": "'"$(date -Iseconds)"'",
        "metadata": { "role": "leader" }
      }'
```

**Notes:**
- Auth required. Events are stored/logged for ops dashboards.
- Do **not** send PII or tokens; hash tab IDs if needed.

---

## 4. **Reports Service** (`/reports`)

### **📅 Daily Reports:**

#### **4.1 Get Daily Report** ✅ TESTED
```bash
GET /reports/daily-report
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)

# Get today's report
curl -X GET "http://localhost:4000/reports/daily-report?propertyId=1" \
  -H "Authorization: Bearer $TOKEN"

# Get specific date
curl -X GET "http://localhost:4000/reports/daily-report?propertyId=1&date=2025-10-05" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "date": "2025-10-05",
  "propertyId": 1,
  "propertyName": null,
  "openingBalanceCents": 0,
  "cashReceivedCents": 220000,
  "bankReceivedCents": 0,
  "totalReceivedCents": 220000,
  "cashExpensesCents": 0,
  "bankExpensesCents": 0,
  "totalExpensesCents": 0,
  "closingBalanceCents": 220000,
  "netCashFlowCents": 220000,
  "isOpeningBalanceAutoCalculated": true,
  "calculatedClosingBalanceCents": 220000,
  "balanceDiscrepancyCents": 0,
  "transactions": [...],
  "cashBalance": null
}
```

**Tested:** ✅ Working with IST timezone filtering

---

#### **4.2 Get Daily Reports (Range)** ✅ TESTED
```bash
GET /reports/daily-reports
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X GET "http://localhost:4000/reports/daily-reports?propertyId=1&startDate=2025-10-01&endDate=2025-10-08" \
  -H "Authorization: Bearer $TOKEN"
```

---

### **📆 Monthly Reports:**

#### **4.3 Get Monthly Report** ✅ TESTED
```bash
GET /reports/monthly-report
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X GET "http://localhost:4000/reports/monthly-report?propertyId=1&year=2025&month=10" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "year": 2025,
  "month": 10,
  "monthName": "October",
  "propertyId": 1,
  "propertyName": "test1",
  "openingBalanceCents": 0,
  "totalCashReceivedCents": 672000,
  "totalBankReceivedCents": 0,
  "totalCashExpensesCents": 162000,
  "totalBankExpensesCents": 0,
  "closingBalanceCents": 510000,
  "netCashFlowCents": 510000,
  "profitMargin": 75.89,
  "transactionCount": 6,
  "dailyReports": [...]
}
```

---

#### **4.4 Get Monthly Summary** ✅ TESTED
```bash
GET /reports/monthly-summary
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X GET "http://localhost:4000/reports/monthly-summary?year=2025&month=10&propertyId=1" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "year": "2025",
  "month": "10",
  "propertyId": 1,
  "propertyName": "test1",
  "totalRevenue": 6720.00,
  "totalExpenses": 1620.00,
  "netIncome": 5100.00,
  "profitMargin": 75.9,
  "daysWithTransactions": 3,
  "totalDays": 31,
  "averageDailyRevenue": 2240.00,
  "averageDailyExpenses": 540.00
}
```

**Tested:** ✅ IST timezone filtering verified

---

### **📊 Quarterly Reports:**

#### **4.5 Get Quarterly Summary** ✅ TESTED ⭐ NEW
```bash
GET /reports/quarterly-summary
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)

# Q1 2025 (Jan-Mar)
curl -X GET "http://localhost:4000/reports/quarterly-summary?year=2025&quarter=1&propertyId=1" \
  -H "Authorization: Bearer $TOKEN"

# Q2 2025 (Apr-Jun)
curl -X GET "http://localhost:4000/reports/quarterly-summary?year=2025&quarter=2&propertyId=1" \
  -H "Authorization: Bearer $TOKEN"

# Q3 2025 (Jul-Sep)
curl -X GET "http://localhost:4000/reports/quarterly-summary?year=2025&quarter=3&propertyId=3" \
  -H "Authorization: Bearer $TOKEN"

# Q4 2025 (Oct-Dec)
curl -X GET "http://localhost:4000/reports/quarterly-summary?year=2025&quarter=4&propertyId=1" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "year": "2025",
  "quarter": 3,
  "quarterName": "Q3",
  "propertyId": 3,
  "propertyName": "HostelExp Munroe",
  "totalRevenue": 18500.00,
  "totalExpenses": 2500.00,
  "netIncome": 16000.00,
  "profitMargin": 86.5,
  "monthsWithTransactions": 3,
  "totalMonths": 3,
  "averageMonthlyRevenue": 6166.67,
  "averageMonthlyExpenses": 833.33,
  "monthlyBreakdown": [
    {
      "month": "July",
      "monthNumber": 7,
      "revenue": 6000.00,
      "expenses": 0.00,
      "netIncome": 6000.00
    },
    {
      "month": "August",
      "monthNumber": 8,
      "revenue": 7500.00,
      "expenses": 1500.00,
      "netIncome": 6000.00
    },
    {
      "month": "September",
      "monthNumber": 9,
      "revenue": 5000.00,
      "expenses": 1000.00,
      "netIncome": 4000.00
    }
  ]
}
```

**Quarters:**
- `quarter=1`: Q1 (January, February, March)
- `quarter=2`: Q2 (April, May, June)
- `quarter=3`: Q3 (July, August, September)
- `quarter=4`: Q4 (October, November, December)

**Tested:** ✅ IST timezone filtering verified, data aggregation verified

---

### **📈 Yearly Reports:**

#### **4.6 Get Yearly Summary** ✅ TESTED
```bash
GET /reports/yearly-summary
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)

curl -X GET "http://localhost:4000/reports/yearly-summary?year=2025&propertyId=3" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "year": "2025",
  "propertyId": 3,
  "propertyName": "HostelExp Munroe",
  "totalRevenue": 18500.00,
  "totalExpenses": 2500.00,
  "netIncome": 16000.00,
  "profitMargin": 86.5,
  "monthsWithTransactions": 3,
  "totalMonths": 12,
  "averageMonthlyRevenue": 6166.67,
  "averageMonthlyExpenses": 833.33,
  "monthlyBreakdown": [
    {"month": "January", "revenue": 0.00, "expenses": 0.00, "netIncome": 0.00},
    ...
    {"month": "July", "revenue": 6000.00, "expenses": 0.00, "netIncome": 6000.00},
    {"month": "August", "revenue": 7500.00, "expenses": 1500.00, "netIncome": 6000.00},
    {"month": "September", "revenue": 5000.00, "expenses": 1000.00, "netIncome": 4000.00},
    ...
    {"month": "December", "revenue": 0.00, "expenses": 0.00, "netIncome": 0.00}
  ]
}
```

**Tested:** ✅ IST timezone filtering verified, quarterly aggregation verified

---

#### **4.7 Get Monthly-Yearly Report (Flexible)** ✅ TESTED
```bash
GET /reports/monthly-yearly-report
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)

# Custom date range (can be used for quarterly/yearly)
curl -X GET "http://localhost:4000/reports/monthly-yearly-report?propertyId=3&startDate=2025-07-01&endDate=2025-09-30" \
  -H "Authorization: Bearer $TOKEN"

# Full year
curl -X GET "http://localhost:4000/reports/monthly-yearly-report?propertyId=3&startDate=2025-01-01&endDate=2025-12-31" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "data": {
    "totalRevenue": 18500.00,
    "totalExpenses": 2500.00,
    "netIncome": 16000.00,
    "profitMargin": 86.5,
    "revenueBySource": {
      "room": 18500.00,
      "addon": 0.00,
      "other": 0.00
    },
    "expensesByCategory": {
      "maintenance": 1000.00,
      "utilities": 1500.00
    }
  },
  "period": {
    "startDate": "2025-07-01T00:00:00.000Z",
    "endDate": "2025-09-30T23:59:59.999Z"
  },
  "propertyId": 3,
  "propertyName": "HostelExp Munroe"
}
```

**Tested:** ✅ IST timezone filtering verified

---

### **📄 Export Endpoints:**

#### **4.8 Export Daily Report to PDF**
```bash
POST /reports/export-daily-pdf
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X POST "http://localhost:4000/reports/export-daily-pdf" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "propertyId": 1,
    "date": "2025-10-08"
  }' | python3 -c "
import sys, json, base64
data = json.load(sys.stdin)
with open(data['filename'], 'wb') as f:
    f.write(base64.b64decode(data['pdfData']))
print(f'Saved: {data[\"filename\"]}')
"
```

---

#### **4.9 Export Daily Report to Excel**
```bash
POST /reports/export-daily-excel
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X POST "http://localhost:4000/reports/export-daily-excel" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "propertyId": 1,
    "date": "2025-10-08"
  }' | python3 -c "
import sys, json, base64
data = json.load(sys.stdin)
with open(data['filename'], 'wb') as f:
    f.write(base64.b64decode(data['excelData']))
print(f'Saved: {data[\"filename\"]}')
"
```

---

#### **4.10 Export Monthly Report to PDF**
```bash
POST /reports/export-monthly-pdf
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X POST "http://localhost:4000/reports/export-monthly-pdf" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "propertyId": 1,
    "year": 2025,
    "month": 10
  }' | python3 -c "
import sys, json, base64
data = json.load(sys.stdin)
with open(data['filename'], 'wb') as f:
    f.write(base64.b64decode(data['pdfData']))
print(f'Saved: {data[\"filename\"]}')
"
```

---

#### **4.11 Export Monthly Report to Excel**
```bash
POST /reports/export-monthly-excel
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X POST "http://localhost:4000/reports/export-monthly-excel" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "propertyId": 1,
    "year": 2025,
    "month": 10
  }' | python3 -c "
import sys, json, base64
data = json.load(sys.stdin)
with open(data['filename'], 'wb') as f:
    f.write(base64.b64decode(data['excelData']))
print(f'Saved: {data[\"filename\"]}')
"
```

---

### **💰 Cash Balance Management:**

#### **4.12 Update Daily Cash Balance**
```bash
POST /reports/daily-cash-balance
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X POST "http://localhost:4000/reports/daily-cash-balance" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "propertyId": 1,
    "date": "2025-10-08",
    "openingBalanceCents": 0,
    "cashReceivedCents": 500000,
    "bankReceivedCents": 100000,
    "cashExpensesCents": 150000,
    "bankExpensesCents": 50000,
    "closingBalanceCents": 350000
  }'
```

---

#### **4.13 Smart Daily Cash Balance Update** (Auto-calculates opening balance)
```bash
POST /reports/daily-cash-balance-smart
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X POST "http://localhost:4000/reports/daily-cash-balance-smart" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "propertyId": 1,
    "date": "2025-10-08",
    "cashReceivedCents": 500000,
    "bankReceivedCents": 100000,
    "cashExpensesCents": 150000,
    "bankExpensesCents": 50000
  }'
```

---

## 5. **Staff Service** (`/staff`)

### **👥 Staff Management:**

#### **5.1 List Staff**
```bash
GET /staff
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)

# List all staff
curl -X GET "http://localhost:4000/staff" \
  -H "Authorization: Bearer $TOKEN"

# Filter by property
curl -X GET "http://localhost:4000/staff?propertyId=1" \
  -H "Authorization: Bearer $TOKEN"

# Filter by department and status
curl -X GET "http://localhost:4000/staff?department=front_desk&status=active" \
  -H "Authorization: Bearer $TOKEN"

# Pagination and search
curl -X GET "http://localhost:4000/staff?page=1&limit=20&search=John" \
  -H "Authorization: Bearer $TOKEN"
```

---

#### **5.2 Create Staff** (Admin Only)
```bash
POST /staff
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X POST "http://localhost:4000/staff" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 5,
    "propertyId": 1,
    "department": "front_desk",
    "hourlyRateCents": 50000,
    "hireDate": "2025-10-01",
    "notes": "Experienced receptionist",
    "status": "active",
    "salaryType": "hourly",
    "attendanceTrackingEnabled": true
  }'
```

---

#### **5.3 Update Staff**
```bash
PUT /staff/update
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X PUT "http://localhost:4000/staff/update" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": 1,
    "department": "management",
    "hourlyRateCents": 60000,
    "status": "active",
    "performanceRating": 4.5
  }'
```

---

#### **5.4 Delete Staff**
```bash
DELETE /staff/:id
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
STAFF_ID=1
curl -X DELETE "http://localhost:4000/staff/${STAFF_ID}" \
  -H "Authorization: Bearer $TOKEN"
```

---

#### **5.5 Update Staff Status**
```bash
PATCH /staff/:id/status
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
STAFF_ID=1
curl -X PATCH "http://localhost:4000/staff/${STAFF_ID}/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "inactive"
  }'
```

**Statuses:** `active`, `inactive`, `on_leave`, `terminated`

---

#### **5.6 Search Staff**
```bash
GET /staff/search
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X GET "http://localhost:4000/staff/search?query=John&department=front_desk" \
  -H "Authorization: Bearer $TOKEN"
```

---

#### **5.7 Get Staff Statistics**
```bash
GET /staff/statistics
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X GET "http://localhost:4000/staff/statistics?propertyId=1" \
  -H "Authorization: Bearer $TOKEN"
```

---

### **📅 Attendance Management:**

#### **5.8 Check In**
```bash
POST /staff/check-in
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X POST "http://localhost:4000/staff/check-in" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "staffId": 1,
    "checkInTime": "09:00:00",
    "date": "2025-10-08"
  }'
```

---

#### **5.9 Check Out**
```bash
POST /staff/check-out
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X POST "http://localhost:4000/staff/check-out" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "staffId": 1,
    "checkOutTime": "18:00:00",
    "date": "2025-10-08"
  }'
```

---

#### **5.10 List Attendance**
```bash
GET /staff/attendance
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)

# List all attendance
curl -X GET "http://localhost:4000/staff/attendance" \
  -H "Authorization: Bearer $TOKEN"

# Filter by staff and date range
curl -X GET "http://localhost:4000/staff/attendance?staffId=1&startDate=2025-10-01&endDate=2025-10-31" \
  -H "Authorization: Bearer $TOKEN"
```

---

#### **5.11 Update Attendance**
```bash
PATCH /staff/attendance/:id
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
ATTENDANCE_ID=1
curl -X PATCH "http://localhost:4000/staff/attendance/${ATTENDANCE_ID}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "present",
    "workHours": 9.0,
    "overtimeHours": 1.5
  }'
```

---

### **🏖️ Leave Management:**

#### **5.12 Request Leave**
```bash
POST /staff/leave-request
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X POST "http://localhost:4000/staff/leave-request" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "staffId": 1,
    "leaveType": "sick",
    "startDate": "2025-10-10",
    "endDate": "2025-10-12",
    "reason": "Medical appointment",
    "halfDay": false
  }'
```

**Leave Types:** `sick`, `casual`, `earned`, `emergency`, `unpaid`

---

#### **5.13 List Leave Requests**
```bash
GET /staff/leave-requests
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)

# List all leave requests
curl -X GET "http://localhost:4000/staff/leave-requests" \
  -H "Authorization: Bearer $TOKEN"

# Filter by status
curl -X GET "http://localhost:4000/staff/leave-requests?status=pending" \
  -H "Authorization: Bearer $TOKEN"
```

---

#### **5.14 Approve Leave Request**
```bash
POST /staff/leave-approve
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X POST "http://localhost:4000/staff/leave-approve" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "leaveRequestId": 1,
    "approved": true,
    "notes": "Approved for medical reasons"
  }'
```

---

### **💰 Payroll Management:**

#### **5.15 Calculate Salary**
```bash
POST /staff/calculate-salary
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X POST "http://localhost:4000/staff/calculate-salary" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "staffId": 1,
    "month": "2025-10"
  }'
```

---

#### **5.16 Generate Payslip**
```bash
POST /staff/generate-payslip
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X POST "http://localhost:4000/staff/generate-payslip" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "staffId": 1,
    "month": "2025-10",
    "year": "2025"
  }'
```

---

#### **5.17 List Payslips**
```bash
GET /staff/payslips
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X GET "http://localhost:4000/staff/payslips?staffId=1" \
  -H "Authorization: Bearer $TOKEN"
```

---

### **📊 Schedule Management:**

#### **5.18 Create Schedule**
```bash
POST /staff/schedules
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X POST "http://localhost:4000/staff/schedules" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "staffId": 1,
    "date": "2025-10-09",
    "shiftStart": "09:00:00",
    "shiftEnd": "18:00:00",
    "shiftType": "morning",
    "propertyId": 1
  }'
```

---

#### **5.19 List Schedules**
```bash
GET /staff/schedules
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X GET "http://localhost:4000/staff/schedules?staffId=1&startDate=2025-10-01&endDate=2025-10-31" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 6. **Users Service** (`/users`)

### **👤 User Management:**

#### **6.1 List Users**
```bash
GET /users/list
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)

# List all users
curl -X GET "http://localhost:4000/users/list" \
  -H "Authorization: Bearer $TOKEN"

# Filter by role
curl -X GET "http://localhost:4000/users/list?role=MANAGER" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "users": [
    {
      "id": 2,
      "email": "shreya@gmail.com",
      "displayName": "Shreya",
      "role": "ADMIN",
      "orgId": 2,
      "createdAt": "2025-10-02T05:14:52.944Z"
    }
  ]
}
```

---

#### **6.2 Get User by ID**
```bash
GET /users/{id}
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
USER_ID=2
curl -X GET "http://localhost:4000/users/${USER_ID}" \
  -H "Authorization: Bearer $TOKEN"
```

---

#### **6.3 Create User** (Admin Only)
```bash
POST /users/create
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X POST "http://localhost:4000/users/create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "manager@example.com",
    "password": "ManagerPass123!",
    "displayName": "Property Manager",
    "role": "MANAGER"
  }'
```

**Roles:** `ADMIN`, `MANAGER`

---

#### **6.4 Update User**
```bash
PUT /users/update
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X PUT "http://localhost:4000/users/update" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": 3,
    "displayName": "Updated Manager Name",
    "email": "updated.manager@example.com",
    "phone": "+91-9876543210"
  }'
```

---

#### **6.5 Delete User**
```bash
DELETE /users/delete
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X DELETE "http://localhost:4000/users/delete" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": 5
  }'
```

---

### **🏢 Property Assignment:**

#### **6.6 Assign Properties to Manager**
```bash
POST /users/assign-properties
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X POST "http://localhost:4000/users/assign-properties" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 3,
    "propertyIds": [1, 3]
  }'
```

---

### **🔐 Role Management:**

#### **6.7 Promote to Admin**
```bash
POST /users/promote-admin
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X POST "http://localhost:4000/users/promote-admin" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 3
  }'
```

---

#### **6.8 Demote to Manager**
```bash
POST /users/demote-manager
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X POST "http://localhost:4000/users/demote-manager" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 4
  }'
```

---

## 7. **Tasks Service** (`/tasks`)

### **✅ Task Management:**

#### **7.1 List Tasks**
```bash
GET /tasks
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)

# List all tasks
curl -X GET "http://localhost:4000/tasks" \
  -H "Authorization: Bearer $TOKEN"

# Filter by property and status
curl -X GET "http://localhost:4000/tasks?propertyId=1&status=pending" \
  -H "Authorization: Bearer $TOKEN"

# Filter by priority
curl -X GET "http://localhost:4000/tasks?priority=high" \
  -H "Authorization: Bearer $TOKEN"
```

---

#### **7.2 Create Task**
```bash
POST /tasks
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X POST "http://localhost:4000/tasks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Fix AC in Room 201",
    "description": "AC not cooling properly, needs repair",
    "propertyId": 1,
    "priority": "high",
    "status": "pending",
    "dueDate": "2025-10-10T18:00:00.000Z",
    "assignedToStaffId": 1,
    "estimatedHours": 2.0
  }'
```

**Priorities:** `low`, `medium`, `high`, `urgent`  
**Statuses:** `pending`, `in_progress`, `completed`, `cancelled`

---

#### **7.3 Update Task**
```bash
PATCH /tasks/:id
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
TASK_ID=1
curl -X PATCH "http://localhost:4000/tasks/${TASK_ID}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in_progress",
    "progress": 50,
    "notes": "Working on AC repair"
  }'
```

---

#### **7.4 Delete Task**
```bash
DELETE /tasks/:id
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
TASK_ID=1
curl -X DELETE "http://localhost:4000/tasks/${TASK_ID}" \
  -H "Authorization: Bearer $TOKEN"
```

---

#### **7.5 Assign Task to Staff**
```bash
PATCH /tasks/:id/assign
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
TASK_ID=1
curl -X PATCH "http://localhost:4000/tasks/${TASK_ID}/assign" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "staffId": 2
  }'
```

---

#### **7.6 Update Task Status**
```bash
PATCH /tasks/:id/status
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
TASK_ID=1
curl -X PATCH "http://localhost:4000/tasks/${TASK_ID}/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed"
  }'
```

---

#### **7.7 Update Task Hours**
```bash
PATCH /tasks/:id/hours
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
TASK_ID=1
curl -X PATCH "http://localhost:4000/tasks/${TASK_ID}/hours" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "actualHours": 2.5
  }'
```

---

### **📎 Task Attachments:**

#### **7.8 Add Task Attachment**
```bash
POST /tasks/attachments
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X POST "http://localhost:4000/tasks/attachments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": 1,
    "fileId": 123,
    "description": "Before photo of AC unit"
  }'
```

---

#### **7.9 Upload Task Image**
```bash
POST /tasks/:taskId/images
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
TASK_ID=1
IMAGE_FILE="/path/to/image.jpg"
BASE64_IMAGE=$(base64 < "$IMAGE_FILE" | tr -d '\n')

curl -X POST "http://localhost:4000/tasks/${TASK_ID}/images" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"imageData\": \"$BASE64_IMAGE\",
    \"filename\": \"task_photo.jpg\",
    \"mimeType\": \"image/jpeg\",
    \"description\": \"Task completion photo\"
  }"
```

---

#### **7.10 Get Task Images**
```bash
GET /tasks/:taskId/images
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
TASK_ID=1
curl -X GET "http://localhost:4000/tasks/${TASK_ID}/images" \
  -H "Authorization: Bearer $TOKEN"
```

---

#### **7.11 Delete Task Image**
```bash
DELETE /tasks/:taskId/images/:imageId
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
TASK_ID=1
IMAGE_ID=5
curl -X DELETE "http://localhost:4000/tasks/${TASK_ID}/images/${IMAGE_ID}" \
  -H "Authorization: Bearer $TOKEN"
```

---

#### **7.12 Set Primary Image**
```bash
PUT /tasks/:taskId/images/:imageId/primary
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
TASK_ID=1
IMAGE_ID=5
curl -X PUT "http://localhost:4000/tasks/${TASK_ID}/images/${IMAGE_ID}/primary" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 8. **Organizations Service** (`/orgs`)

### **8.1 Create Organization**
```bash
POST /orgs/create
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X POST "http://localhost:4000/orgs/create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Hotel Chain",
    "email": "admin@hotelchain.com",
    "phone": "+91-1234567890",
    "address": "Corporate Office, Mumbai"
  }'
```

---

### **8.2 Invite User to Organization**
```bash
POST /orgs/invite
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X POST "http://localhost:4000/orgs/invite" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newmember@example.com",
    "role": "MANAGER",
    "message": "Welcome to our organization"
  }'
```

---

## 9. **Uploads Service** (`/uploads`)

### **9.1 Upload File**
```bash
POST /uploads/file
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
FILE_PATH="/path/to/receipt.jpg"
BASE64_DATA=$(base64 < "$FILE_PATH" | tr -d '\n')

curl -X POST "http://localhost:4000/uploads/file" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"fileData\": \"$BASE64_DATA\",
    \"filename\": \"receipt_oct8.jpg\",
    \"mimeType\": \"image/jpeg\"
  }"
```

**Response:**
```json
{
  "fileId": 123,
  "filename": "receipt_oct8.jpg",
  "url": "/uploads/download?fileId=123",
  "mimeType": "image/jpeg",
  "sizeBytes": 245760
}
```

**Supported File Types:**
- **Images:** JPEG, PNG, GIF, WebP
- **Documents:** PDF
- **Max Size:** 10MB

---

### **9.2 Download File**
```bash
GET /uploads/download
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
FILE_ID=123
curl -X GET "http://localhost:4000/uploads/download?fileId=${FILE_ID}" \
  -H "Authorization: Bearer $TOKEN" \
  -o downloaded_receipt.jpg
```

---

### **9.3 Delete File**
```bash
DELETE /uploads/delete
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X DELETE "http://localhost:4000/uploads/delete" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fileId": 123
  }'
```

---

## 10. **Branding Service** (`/branding`)

### **10.1 Get Theme**
```bash
GET /branding/theme
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X GET "http://localhost:4000/branding/theme" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "primaryColor": "#3B82F6",
  "secondaryColor": "#10B981",
  "currency": "INR",
  "dateFormat": "DD/MM/YYYY",
  "timeZone": "Asia/Kolkata"
}
```

---

### **10.2 Update Theme**
```bash
POST /branding/theme
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X POST "http://localhost:4000/branding/theme" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "primaryColor": "#2563EB",
    "secondaryColor": "#059669",
    "currency": "INR",
    "dateFormat": "DD/MM/YYYY",
    "timeZone": "Asia/Kolkata"
  }'
```

---

### **10.3 Upload Logo**
```bash
POST /branding/logo
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
LOGO_PATH="/path/to/logo.png"
BASE64_LOGO=$(base64 < "$LOGO_PATH" | tr -d '\n')

curl -X POST "http://localhost:4000/branding/logo" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"logoData\": \"$BASE64_LOGO\",
    \"filename\": \"company_logo.png\",
    \"mimeType\": \"image/png\"
  }"
```

---

### **10.4 Get Logo**
```bash
GET /branding/logo
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X GET "http://localhost:4000/branding/logo" \
  -H "Authorization: Bearer $TOKEN" \
  -o company_logo.png
```

---

## 11. **Analytics Service** (`/analytics`)

### **11.1 Get Analytics Overview**
```bash
GET /analytics/overview
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)

# Overall analytics
curl -X GET "http://localhost:4000/analytics/overview" \
  -H "Authorization: Bearer $TOKEN"

# Filter by property and date
curl -X GET "http://localhost:4000/analytics/overview?propertyId=1&startDate=2025-10-01&endDate=2025-10-31" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 12. **Guest Check-in Service** (`/guest-checkin`) ⭐ NEW

Modern guest intake with AI-powered document extraction, audit logging, and realtime updates. All endpoints require authentication; managers and admins have broader access than front-desk staff.

### **12.1 List Check-ins**
```bash
GET /guest-checkin/list
```

**Query Parameters:** `status`, `guestType`, `propertyId`, `startDate`, `endDate`, `search`, `limit`, `offset`, `sortBy`, `sortOrder`.

**Request:**
```bash
curl -X GET "http://localhost:4000/guest-checkin/list?status=checked_in&propertyId=1&limit=25" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "items": [
    {
      "id": 123,
      "guestType": "indian",
      "fullName": "Ananya Sharma",
      "email": "ananya@example.com",
      "phone": "+91 9876543210",
      "roomNumber": "201",
      "checkInDate": "2025-10-10T12:00:00Z",
      "expectedCheckoutDate": "2025-10-15",
      "status": "checked_in",
      "propertyName": "test1"
    }
  ],
  "total": 1,
  "limit": 25,
  "offset": 0
}
```

### **12.2 Get Single Check-in**
```bash
GET /guest-checkin/:id
```

Returns complete record (person details, documents, timestamps). Non-admin users can only fetch records they created.

### **12.3 Create Check-in**
```bash
POST /guest-checkin/create
```

```bash
curl -X POST "http://localhost:4000/guest-checkin/create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
        "propertyId": 1,
        "guestType": "indian",
        "fullName": "Ananya Sharma",
        "email": "ananya@example.com",
        "phone": "+91 9876543210",
        "address": "123 Park Street, Kolkata",
        "aadharNumber": "123456789012",
        "roomNumber": "201",
        "numberOfGuests": 2
      }'
```

### **12.4 Create Check-in with Documents**
```bash
POST /guest-checkin/create-with-documents
```

Allows bundling the intake form plus up to six documents. Each document entry accepts `documentType`, `fileData` (base64), `filename`, `mimeType`, optional `performExtraction`. Entire transaction rolls back if any upload fails.

### **12.5 Update Check-in**
```bash
PUT /guest-checkin/:id/update
```

Patched fields include contact info, room number, IDs, and expected checkout. Non-admins can only update their own records.

### **12.6 Check-out Guest**
```bash
POST /guest-checkin/:id/checkout
```

Body: `{ "actualCheckoutDate": "2025-10-12T10:00:00Z" }` (optional). Marks the record as `checked_out`, writes audit log, and broadcasts realtime event for dashboards.

### **12.7 Delete Check-in**
```bash
DELETE /guest-checkin/:id
```

Admins/owners only. Cascades document cleanup and emits audit entry.

### **12.8 Check-in Statistics**
```bash
GET /guest-checkin/stats
```

**Query Parameters:** `propertyId`, `startDate`, `endDate`.

**Response (abridged):**
```json
{
  "totalCheckins": 145,
  "currentlyCheckedIn": 32,
  "checkedOut": 110,
  "indianGuests": 120,
  "foreignGuests": 25,
  "byProperty": [
    { "propertyId": 1, "propertyName": "test1", "count": 95 },
    { "propertyId": 3, "propertyName": "HostelExp Munroe", "count": 50 }
  ]
}
```

---

### 📎 **Guest Document Management**

#### **12.9 Upload Document with LLM Extraction**
```bash
POST /guest-checkin/documents/upload
```

```bash
curl -X POST "http://localhost:4000/guest-checkin/documents/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
        "guestCheckInId": 123,
        "documentType": "aadhaar_front",
        "fileData": "/9j/4AAQSkZJRgABAQEAYABgAAD...",
        "filename": "aadhaar_front.jpg",
        "mimeType": "image/jpeg",
        "performExtraction": true
      }'
```

**Response (abridged):**
```json
{
  "success": true,
  "document": {
    "id": 456,
    "documentType": "aadhaar_front",
    "filename": "aadhaar_front_20251010.jpg",
    "thumbnailUrl": "/guest-checkin/documents/456/thumbnail",
    "uploadedAt": "2025-10-10T12:05:30Z"
  },
  "extraction": {
    "status": "completed",
    "overallConfidence": 92,
    "data": {
      "fullName": {"value": "Ananya Sharma", "confidence": 95},
      "aadharNumber": {"value": "1234 5678 9012", "confidence": 98}
    }
  }
}
```

#### **12.10 List Documents**
```bash
GET /guest-checkin/:checkInId/documents
```

Optional query params: `documentType`, `includeDeleted`.

#### **12.11 View / Download / Thumbnail**
```bash
GET /guest-checkin/documents/:documentId/view
GET /guest-checkin/documents/:documentId/download
GET /guest-checkin/documents/:documentId/thumbnail
```

Returns base64 file data for inline viewing/download; thumbnails return a signed URL path.

#### **12.12 Verify Extracted Data**
```bash
POST /guest-checkin/documents/:documentId/verify
```

Payload example:
```json
{
  "correctedData": {
    "address": "123, Rose Villa, MG Road, Bangalore"
  },
  "notes": "Corrected address from passport"
}
```

#### **12.13 Delete Document**
```bash
DELETE /guest-checkin/documents/:documentId
```

Soft-deletes the file and records an audit log. Use `includeDeleted=true` on the list endpoint to review removed items.

#### **12.14 Retry Extraction**
```bash
POST /guest-checkin/documents/:documentId/retry-extraction
```

Reprocesses the stored image through the LLM extractor (useful if the first attempt failed).

#### **12.15 Document Stats**
```bash
GET /guest-checkin/documents/stats?propertyId=1
```

Returns aggregate counts, average confidence, top document types, and storage usage per property.

---

### 🕵️ **Audit Logs & Compliance**

| Endpoint | Description |
|----------|-------------|
| `GET /guest-checkin/audit-logs` | Paginated list of all guest-related actions; filters for `userId`, `guestCheckInId`, `actionType`, `resourceType`, `startDate`, `endDate`, `success`. |
| `GET /guest-checkin/audit-logs/:logId` | Detailed view of a single audit entry with request context. |
| `GET /guest-checkin/audit-logs/export` | Exports CSV for a date range (use `startDate` / `endDate`). |
| `GET /guest-checkin/audit-logs/summary` | Aggregated counts per action plus security alerts. |
| `POST /guest-checkin/audit/view-documents` | Records that a user opened the document viewer (front-end helper endpoint). |

**Example (List Audit Logs):**
```bash
curl -X GET "http://localhost:4000/guest-checkin/audit-logs?startDate=2025-10-01&endDate=2025-10-15&actionType=view_documents" \
  -H "Authorization: Bearer $TOKEN"
```

**Response (abridged):**
```json
{
  "logs": [
    {
      "id": 9876,
      "timestamp": "2025-10-10T12:10:00Z",
      "user": { "id": 10, "email": "manager@hotel.com", "role": "MANAGER" },
      "action": { "type": "view_documents", "resourceType": "guest_document", "resourceId": 456 },
      "guest": { "checkInId": 123, "name": "Ananya Sharma" },
      "success": true,
      "durationMs": 234
    }
  ],
  "pagination": { "total": 150, "limit": 20, "offset": 0, "hasMore": true }
}
```

---

### 🔁 **Realtime Guest Updates**

```bash
GET /guest-checkin/realtime/subscribe
```

Long-poll (25 s) endpoint mirroring the finance realtime stack. Events cover `guest_checkin_created`, `guest_document_uploaded`, `guest_document_extracted`, `guest_checked_out`, etc. Follow the same leader/follower guidance listed in the Finance section (single tab per session maintains the connection; followers listen via `BroadcastChannel('guest-events')`, respect RTT-aware backoff, and stop on logout broadcasts).

Event schema:
```json
{
  "events": [
    {
      "eventType": "guest_document_extracted",
      "timestamp": "2025-10-10T12:05:35.000Z",
      "entityId": 123,
      "entityType": "guest_checkin",
      "metadata": {
        "documentId": 456,
        "status": "completed",
        "overallConfidence": 92
      }
    }
  ],
  "lastEventId": "2025-10-10T12:05:35.000Z"
}
```

---

## **Testing Scripts**

### **Complete CRUD Test Suite:**

```bash
#!/bin/bash
# Save as: test_all_crud_operations.sh

BASE_URL="http://localhost:4000"

# ============================================================================
# STEP 1: AUTHENTICATION
# ============================================================================
echo "🔐 Step 1: Login and get access token..."
TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "shreya@gmail.com", "password": "123456789"}' \
  | python3 -c "import sys, json; print(json.load(sys.stdin)['accessToken'])")

echo "✅ Token obtained: ${TOKEN:0:50}..."

# ============================================================================
# STEP 2: TEST PROPERTIES
# ============================================================================
echo "\n📋 Step 2: Testing Properties..."

# List properties
PROPS=$(curl -s -X GET "$BASE_URL/properties" -H "Authorization: Bearer $TOKEN")
PROP_COUNT=$(echo $PROPS | python3 -c "import sys, json; print(len(json.load(sys.stdin)['properties']))")
echo "✅ Found $PROP_COUNT properties"

# ============================================================================
# STEP 3: TEST FINANCE - CREATE REVENUE
# ============================================================================
echo "\n💰 Step 3: Testing Finance - Create Revenue..."

REVENUE_RESPONSE=$(curl -s -X POST "$BASE_URL/finance/revenues" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "propertyId": 1,
    "amountCents": 300000,
    "paymentMode": "cash",
    "description": "Test revenue via API",
    "source": "room",
    "occurredAt": "2025-10-08T12:00:00.000Z"
  }')

REVENUE_ID=$(echo $REVENUE_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('id', 'Failed'))")
echo "✅ Revenue created: ID=$REVENUE_ID"

# ============================================================================
# STEP 4: TEST FINANCE - CREATE EXPENSE
# ============================================================================
echo "\n💸 Step 4: Testing Finance - Create Expense..."

EXPENSE_RESPONSE=$(curl -s -X POST "$BASE_URL/finance/expenses" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "propertyId": 1,
    "amountCents": 50000,
    "paymentMode": "cash",
    "description": "Test expense via API",
    "category": "maintenance",
    "expenseDate": "2025-10-08"
  }')

EXPENSE_ID=$(echo $EXPENSE_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('id', 'Failed'))")
echo "✅ Expense created: ID=$EXPENSE_ID"

# ============================================================================
# STEP 5: TEST REPORTS
# ============================================================================
echo "\n📊 Step 5: Testing Reports..."

# Monthly Summary
MONTHLY=$(curl -s -X GET "$BASE_URL/reports/monthly-summary?year=2025&month=10&propertyId=1" \
  -H "Authorization: Bearer $TOKEN")
MONTHLY_REV=$(echo $MONTHLY | python3 -c "import sys, json; print(f'{json.load(sys.stdin)[\"totalRevenue\"]:,.2f}')")
echo "✅ Monthly Summary: Revenue ₹$MONTHLY_REV"

# Quarterly Summary
QUARTERLY=$(curl -s -X GET "$BASE_URL/reports/quarterly-summary?year=2025&quarter=4&propertyId=1" \
  -H "Authorization: Bearer $TOKEN")
QUARTERLY_REV=$(echo $QUARTERLY | python3 -c "import sys, json; print(f'{json.load(sys.stdin)[\"totalRevenue\"]:,.2f}')")
echo "✅ Quarterly Summary (Q4): Revenue ₹$QUARTERLY_REV"

# Yearly Summary
YEARLY=$(curl -s -X GET "$BASE_URL/reports/yearly-summary?year=2025&propertyId=1" \
  -H "Authorization: Bearer $TOKEN")
YEARLY_REV=$(echo $YEARLY | python3 -c "import sys, json; print(f'{json.load(sys.stdin)[\"totalRevenue\"]:,.2f}')")
echo "✅ Yearly Summary: Revenue ₹$YEARLY_REV"

# ============================================================================
# STEP 6: TEST USERS
# ============================================================================
echo "\n👥 Step 6: Testing Users..."

USERS=$(curl -s -X GET "$BASE_URL/users/list" -H "Authorization: Bearer $TOKEN")
USER_COUNT=$(echo $USERS | python3 -c "import sys, json; print(len(json.load(sys.stdin).get('users', [])))")
echo "✅ Found $USER_COUNT users"

# ============================================================================
# STEP 7: TEST TASKS
# ============================================================================
echo "\n✅ Step 7: Testing Tasks..."

TASKS=$(curl -s -X GET "$BASE_URL/tasks" -H "Authorization: Bearer $TOKEN")
TASK_COUNT=$(echo $TASKS | python3 -c "import sys, json; print(len(json.load(sys.stdin).get('tasks', [])))")
echo "✅ Found $TASK_COUNT tasks"

# ============================================================================
# STEP 8: TEST STAFF
# ============================================================================
echo "\n👨‍💼 Step 8: Testing Staff..."

STAFF=$(curl -s -X GET "$BASE_URL/staff" -H "Authorization: Bearer $TOKEN")
STAFF_COUNT=$(echo $STAFF | python3 -c "import sys, json; print(json.load(sys.stdin).get('pagination', {}).get('total', 0))")
echo "✅ Found $STAFF_COUNT staff members"

echo "\n
================================================================================
✅ ALL CRUD OPERATIONS TESTED SUCCESSFULLY
================================================================================
Summary:
- Properties: $PROP_COUNT found
- Revenue created: ID=$REVENUE_ID
- Expense created: ID=$EXPENSE_ID
- Monthly revenue: ₹$MONTHLY_REV
- Quarterly revenue: ₹$QUARTERLY_REV
- Yearly revenue: ₹$YEARLY_REV
- Users: $USER_COUNT found
- Tasks: $TASK_COUNT found
- Staff: $STAFF_COUNT found
================================================================================
"
```

---

## **Common Query Parameters**

### **Filtering:**
| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `propertyId` | integer | Filter by property | `?propertyId=1` |
| `startDate` | string | Start date (YYYY-MM-DD) | `?startDate=2025-10-01` |
| `endDate` | string | End date (YYYY-MM-DD) | `?endDate=2025-10-31` |
| `status` | string | Filter by status | `?status=approved` |
| `paymentMode` | string | Filter by payment mode | `?paymentMode=cash` |
| `category` | string | Filter by category | `?category=maintenance` |
| `source` | string | Filter by revenue source | `?source=room` |

### **Pagination:**
| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `page` | integer | Page number | 1 |
| `limit` | integer | Items per page | 20 |
| `sortBy` | string | Sort field | varies |
| `sortOrder` | string | Sort direction (asc/desc) | asc |

---

## **Response Status Codes**

| Code | Status | Description |
|------|--------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created |
| 400 | Bad Request | Invalid parameters |
| 401 | Unauthorized | Authentication required |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 500 | Internal Server Error | Server error |

---

## **Role-Based Access Control**

### **ADMIN Permissions:**
- ✅ Full access to all endpoints
- ✅ Can approve/reject transactions
- ✅ Can manage all users and roles
- ✅ Can access all properties
- ✅ Can modify system settings
- ✅ Can view all analytics

### **MANAGER Permissions:**
- ✅ Access to assigned properties only
- ✅ Can create transactions (requires daily approval)
- ❌ Cannot approve own transactions
- ✅ Can view assigned property analytics
- ❌ Cannot manage system settings
- ❌ Cannot create/delete properties

---

## **Timezone & Date Formats**

### **Timezone:**
- **System Timezone:** IST (Asia/Kolkata) - UTC+5:30
- **Time Format:** 24-hour format
- **All timestamps** stored with timezone awareness
- **All filtering** uses IST local dates

### **Date Formats:**

#### **Input Formats:**
- **Date:** `YYYY-MM-DD` (e.g., `2025-10-08`)
- **DateTime:** ISO 8601 (e.g., `2025-10-08T14:30:00.000Z`)
- **Time:** `HH:MM:SS` in 24-hour format (e.g., `14:30:00`)

#### **Response Formats:**
- **Date:** `YYYY-MM-DD`
- **DateTime:** ISO 8601 with timezone
- **Display:** Automatically converted to IST in frontend

### **Important Notes:**
- ✅ All revenue `occurredAt` fields use `timestamp with time zone`
- ✅ All expense `expenseDate` fields use `date` type
- ✅ All date filtering uses IST timezone conversion
- ✅ All reports aggregate data by IST local date

---

## **Data Consistency Verification**

### **Report Data Aggregation:**
```bash
TOKEN=$(cat /tmp/token.txt)

# Test that all report types return consistent data
PROPERTY_ID=1
MONTH=10
YEAR=2025

# Monthly Summary
M_REV=$(curl -s -X GET "$BASE_URL/reports/monthly-summary?year=$YEAR&month=$MONTH&propertyId=$PROPERTY_ID" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys, json; print(json.load(sys.stdin)['totalRevenue'])")

# Quarterly Summary (Q4)
Q_REV=$(curl -s -X GET "$BASE_URL/reports/quarterly-summary?year=$YEAR&quarter=4&propertyId=$PROPERTY_ID" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys, json; print(json.load(sys.stdin)['totalRevenue'])")

# Yearly Summary
Y_REV=$(curl -s -X GET "$BASE_URL/reports/yearly-summary?year=$YEAR&propertyId=$PROPERTY_ID" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys, json; print(json.load(sys.stdin)['totalRevenue'])")

echo "Monthly: ₹$M_REV"
echo "Quarterly (Q4): ₹$Q_REV"
echo "Yearly: ₹$Y_REV"

# Should all be equal for October data
```

**Verified:** ✅ All report endpoints return identical data for the same time period

---

## **Error Handling**

### **Common Errors:**

#### **1. Invalid Token (401):**
```json
{
  "code": "unauthenticated",
  "message": "Invalid token",
  "details": null
}
```
**Solution:** Get a fresh access token using login

---

#### **2. Insufficient Permissions (403):**
```json
{
  "code": "permission_denied",
  "message": "Insufficient permissions",
  "details": null
}
```
**Solution:** Check user role and permissions

---

#### **3. Resource Not Found (404):**
```json
{
  "code": "not_found",
  "message": "Property not found",
  "details": null
}
```
**Solution:** Verify resource ID exists

---

#### **4. Invalid Arguments (400):**
```json
{
  "code": "invalid_argument",
  "message": "Invalid date range",
  "details": null
}
```
**Solution:** Check request parameters

---

## **Best Practices**

### **1. Token Management:**
```bash
# Save token to file for reuse
curl -s -X POST "http://localhost:4000/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}' \
  | python3 -c "import sys, json; print(json.load(sys.stdin)['accessToken'])" > token.txt

# Reuse in scripts
TOKEN=$(cat token.txt)
```

### **2. Error Handling:**
```bash
# Check response status
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/properties" \
  -H "Authorization: Bearer $TOKEN")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -1)

if [ "$HTTP_CODE" -eq 200 ]; then
  echo "✅ Success: $BODY"
else
  echo "❌ Error $HTTP_CODE: $BODY"
fi
```

### **3. Date Handling:**
```bash
# Use YYYY-MM-DD format for dates
START_DATE="2025-10-01"
END_DATE="2025-10-31"

# Use ISO 8601 for timestamps
OCCURRED_AT="2025-10-08T14:30:00.000Z"
```

### **4. File Upload:**
```bash
# Ensure file is base64 encoded without newlines
BASE64_DATA=$(base64 < file.jpg | tr -d '\n')
```

---

## **Health Check**

```bash
# Check if backend is healthy
curl -X GET "http://localhost:4000/config/health"

# Expected response:
{"status": "healthy"}
```

---

## **Appendix: Test Credentials**

### **Demo Users:**
| Email | Password | Role | Org ID |
|-------|----------|------|--------|
| shreya@gmail.com | 123456789 | ADMIN | 2 |

### **Demo Properties:**
| ID | Name | Type | Address |
|----|------|------|---------|
| 1 | test1 | hotel | Panaji, Goa |
| 3 | HostelExp Munroe | hostel | - |

---

## **Appendix: Verified Test Results (October 8, 2025)**

### **✅ All Endpoints Tested:**

| Service | Endpoints Tested | Status |
|---------|------------------|--------|
| Auth | Login, Get Me | ✅ Working |
| Properties | List | ✅ Working |
| Finance | Revenues CRUD, Expenses CRUD | ✅ Working |
| Reports | Daily, Monthly, Quarterly, Yearly | ✅ Working |
| Users | List | ✅ Working |
| Tasks | List | ✅ Working |
| Staff | List | ✅ Working |

### **✅ Timezone Consistency:**
- All report endpoints return identical data ✅
- IST timezone filtering working correctly ✅
- Date aggregation verified (Monthly → Quarterly → Yearly) ✅

---

**End of API Complete Reference**

*For development guide, see `DEVELOPMENT.md`*  
*For frontend integration, see `frontend/src/client.ts`*


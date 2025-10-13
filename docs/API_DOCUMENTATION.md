# 🚀 Hospitality Management Platform - API Documentation

**Last Updated:** October 8, 2025  
**Base URL:** `http://localhost:4000`  
**Timezone:** IST (Asia/Kolkata) - All timestamps use 24-hour format in IST  
**Authentication:** Bearer Token (JWT)

---

## 📋 **Table of Contents**

1. [Authentication Service](#1-authentication-service)
2. [Properties Service](#2-properties-service)
3. [Finance Service](#3-finance-service)
4. [Reports Service](#4-reports-service)
5. [Staff Service](#5-staff-service)
6. [Users Service](#6-users-service)
7. [Tasks Service](#7-tasks-service)
8. [Organizations Service](#8-organizations-service)
9. [Uploads Service](#9-uploads-service)
10. [Branding Service](#10-branding-service)
11. [Analytics Service](#11-analytics-service)
12. [Guest Check-in Service](#12-guest-check-in-service) ⭐ NEW

---

## 🔐 **Quick Start - Getting Access Token**

```bash
# Login to get access token
curl -X POST "http://localhost:4000/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "shreya@gmail.com",
    "password": "123456789"
  }' | python3 -c "import sys, json; data = json.load(sys.stdin); print('TOKEN=' + data['accessToken'])" > token.sh

# Source the token
source token.sh

# Or save to file
curl -s -X POST "http://localhost:4000/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "shreya@gmail.com", "password": "123456789"}' \
  | python3 -c "import sys, json; print(json.load(sys.stdin)['accessToken'])" > /tmp/token.txt
```

---

## 1. **Authentication Service**

Base Path: `/auth`

### 📌 **Endpoints:**

#### **1.1 Login**
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

#### **1.2 Signup**
```bash
POST /auth/signup
```

**Request:**
```bash
curl -X POST "http://localhost:4000/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "securePassword123",
    "displayName": "New User",
    "orgName": "My Organization"
  }'
```

---

#### **1.3 Get Current User**
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
  "id": 2,
  "email": "shreya@gmail.com",
  "displayName": "Shreya",
  "role": "ADMIN",
  "orgId": 2,
  "createdAt": "2025-10-02T05:14:52.944Z"
}
```

---

#### **1.4 Refresh Token**
```bash
POST /auth/refresh
```

**Request:**
```bash
REFRESH_TOKEN="your_refresh_token_here"
curl -X POST "http://localhost:4000/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}"
```

---

#### **1.5 Logout**
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

#### **1.6 Forgot Password**
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

#### **1.7 Reset Password**
```bash
POST /auth/reset-password
```

**Request:**
```bash
curl -X POST "http://localhost:4000/auth/reset-password" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "reset_token_from_email",
    "newPassword": "newSecurePassword123"
  }'
```

---

## 2. **Properties Service**

Base Path: `/properties`

### 📌 **Endpoints:**

#### **2.1 List All Properties**
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
      "createdAt": "2025-10-02T05:14:52.944Z"
    }
  ]
}
```

---

#### **2.2 Create Property**
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
    "name": "New Hotel",
    "type": "hotel",
    "addressJson": {
      "street": "123 Main St",
      "city": "Mumbai",
      "state": "Maharashtra",
      "country": "India",
      "zipCode": "400001"
    },
    "capacityJson": {
      "totalRooms": 20,
      "totalBeds": 40
    }
  }'
```

---

#### **2.3 Update Property**
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
    "name": "Updated Hotel Name",
    "type": "hotel",
    "status": "active"
  }'
```

---

#### **2.4 Delete Property**
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
    "id": 1
  }'
```

---

## 3. **Finance Service**

Base Path: `/finance`

### 📌 **Revenue Endpoints:**

#### **3.1 List Revenues**
```bash
GET /finance/revenues
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)

# List all revenues
curl -X GET "http://localhost:4000/finance/revenues" \
  -H "Authorization: Bearer $TOKEN"

# Filter by property and date range
curl -X GET "http://localhost:4000/finance/revenues?propertyId=1&startDate=2025-10-01&endDate=2025-10-31" \
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
      "occurredAt": "2025-10-05T18:30:00.000Z",
      "status": "approved",
      "createdByName": "Shreya",
      "createdAt": "2025-10-05T18:30:00.000Z"
    }
  ]
}
```

---

#### **3.2 Add Revenue**
```bash
POST /finance/revenues
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X POST "http://localhost:4000/finance/revenues" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "propertyId": 3,
    "amountCents": 500000,
    "paymentMode": "cash",
    "description": "Room revenue for October",
    "source": "room",
    "occurredAt": "2025-10-08T10:00:00.000Z"
  }'
```

**Response:**
```json
{
  "id": 123,
  "success": true
}
```

---

#### **3.3 Update Revenue**
```bash
PATCH /finance/revenues/{id}
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
REVENUE_ID=123
curl -X PATCH "http://localhost:4000/finance/revenues/${REVENUE_ID}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amountCents": 550000,
    "description": "Updated room revenue",
    "paymentMode": "bank",
    "bankReference": "UPI123456"
  }'
```

---

#### **3.4 Delete Revenue**
```bash
DELETE /finance/revenues/{id}
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
REVENUE_ID=123
curl -X DELETE "http://localhost:4000/finance/revenues/${REVENUE_ID}" \
  -H "Authorization: Bearer $TOKEN"
```

---

#### **3.5 Approve Revenue (Admin Only)**
```bash
PATCH /finance/revenues/{id}/approve
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
REVENUE_ID=123
curl -X PATCH "http://localhost:4000/finance/revenues/${REVENUE_ID}/approve" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": 123,
    "approved": true
  }'
```

---

### 📌 **Expense Endpoints:**

#### **3.6 List Expenses**
```bash
GET /finance/expenses
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)

# List all expenses
curl -X GET "http://localhost:4000/finance/expenses" \
  -H "Authorization: Bearer $TOKEN"

# Filter by property and date range
curl -X GET "http://localhost:4000/finance/expenses?propertyId=1&startDate=2025-10-01&endDate=2025-10-31" \
  -H "Authorization: Bearer $TOKEN"
```

---

#### **3.7 Add Expense**
```bash
POST /finance/expenses
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X POST "http://localhost:4000/finance/expenses" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "propertyId": 3,
    "amountCents": 150000,
    "paymentMode": "cash",
    "description": "Monthly maintenance",
    "category": "maintenance",
    "expenseDate": "2025-10-08"
  }'
```

---

#### **3.8 Update Expense**
```bash
PATCH /finance/expenses/{id}
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
EXPENSE_ID=456
curl -X PATCH "http://localhost:4000/finance/expenses/${EXPENSE_ID}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amountCents": 160000,
    "description": "Updated maintenance cost",
    "paymentMode": "bank"
  }'
```

---

#### **3.9 Delete Expense**
```bash
DELETE /finance/expenses/{id}
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
EXPENSE_ID=456
curl -X DELETE "http://localhost:4000/finance/expenses/${EXPENSE_ID}" \
  -H "Authorization: Bearer $TOKEN"
```

---

#### **3.10 Approve Expense (Admin Only)**
```bash
PATCH /finance/expenses/{id}/approve
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
EXPENSE_ID=456
curl -X PATCH "http://localhost:4000/finance/expenses/${EXPENSE_ID}/approve" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": 456,
    "approved": true
  }'
```

---

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

#### **3.12 Check Daily Approval Status (Manager)**
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

#### **3.13 Get Pending Approvals**
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

## 4. **Reports Service**

Base Path: `/reports`

### 📌 **Daily Reports:**

#### **4.1 Get Daily Report**
```bash
GET /reports/daily-report
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)

# Get today's report
curl -X GET "http://localhost:4000/reports/daily-report?propertyId=1" \
  -H "Authorization: Bearer $TOKEN"

# Get specific date report
curl -X GET "http://localhost:4000/reports/daily-report?propertyId=1&date=2025-10-05" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "date": "2025-10-05",
  "propertyId": 1,
  "propertyName": "test1",
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
  "transactions": [...]
}
```

---

#### **4.2 Get Daily Reports (Date Range)**
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

### 📌 **Monthly Reports:**

#### **4.3 Get Monthly Report**
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

#### **4.4 Get Monthly Summary**
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

**Tested:** ✅ Working with IST timezone filtering

---

### 📌 **Quarterly Reports:**

#### **4.5 Get Quarterly Summary** ⭐ **NEW**
```bash
GET /reports/quarterly-summary
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)

# Q3 2025 (July, August, September)
curl -X GET "http://localhost:4000/reports/quarterly-summary?year=2025&quarter=3&propertyId=3" \
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
- Q1: January, February, March (quarter=1)
- Q2: April, May, June (quarter=2)
- Q3: July, August, September (quarter=3)
- Q4: October, November, December (quarter=4)

**Tested:** ✅ Working with IST timezone filtering

---

### 📌 **Yearly Reports:**

#### **4.6 Get Yearly Summary**
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
    {
      "month": "January",
      "revenue": 0.00,
      "expenses": 0.00,
      "netIncome": 0.00
    },
    ...
    {
      "month": "July",
      "revenue": 6000.00,
      "expenses": 0.00,
      "netIncome": 6000.00
    }
  ]
}
```

**Tested:** ✅ Working with IST timezone filtering

---

#### **4.7 Get Monthly-Yearly Report (Flexible)**
```bash
GET /reports/monthly-yearly-report
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)

# Get Q3 2025 report
curl -X GET "http://localhost:4000/reports/monthly-yearly-report?propertyId=3&startDate=2025-07-01&endDate=2025-09-30" \
  -H "Authorization: Bearer $TOKEN"

# Get full year report
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

**Tested:** ✅ Working with IST timezone filtering

---

### 📌 **Export Endpoints:**

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
  }' \
  | python3 -c "import sys, json, base64; data = json.load(sys.stdin); open(data['filename'], 'wb').write(base64.b64decode(data['pdfData'])); print(f'Saved: {data[\"filename\"]}')"
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
  }' \
  | python3 -c "import sys, json, base64; data = json.load(sys.stdin); open(data['filename'], 'wb').write(base64.b64decode(data['excelData'])); print(f'Saved: {data[\"filename\"]}')"
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
  }' \
  | python3 -c "import sys, json, base64; data = json.load(sys.stdin); open(data['filename'], 'wb').write(base64.b64decode(data['pdfData'])); print(f'Saved: {data[\"filename\"]}')"
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
  }' \
  | python3 -c "import sys, json, base64; data = json.load(sys.stdin); open(data['filename'], 'wb').write(base64.b64decode(data['excelData'])); print(f'Saved: {data[\"filename\"]}')"
```

---

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
    "bankReceivedCents": 0,
    "cashExpensesCents": 100000,
    "bankExpensesCents": 0,
    "closingBalanceCents": 400000
  }'
```

---

## 5. **Staff Service**

Base Path: `/staff`

### 📌 **Endpoints:**

#### **5.1 List Staff**
```bash
GET /staff/list
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)

# List all staff
curl -X GET "http://localhost:4000/staff/list" \
  -H "Authorization: Bearer $TOKEN"

# Filter by property
curl -X GET "http://localhost:4000/staff/list?propertyId=1" \
  -H "Authorization: Bearer $TOKEN"
```

---

#### **5.2 Create Staff**
```bash
POST /staff/create
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X POST "http://localhost:4000/staff/create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "role": "receptionist",
    "department": "front_desk",
    "email": "john.doe@example.com",
    "phone": "+91-9876543210",
    "propertyIds": [1],
    "status": "active",
    "salaryType": "hourly",
    "hourlyRateCents": 50000,
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
    "name": "John Doe Updated",
    "role": "manager",
    "status": "active",
    "hourlyRateCents": 60000
  }'
```

---

#### **5.4 Delete Staff**
```bash
DELETE /staff/delete
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X DELETE "http://localhost:4000/staff/delete" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": 1
  }'
```

---

#### **5.5 Record Attendance**
```bash
POST /staff/attendance
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X POST "http://localhost:4000/staff/attendance" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "staffId": 1,
    "date": "2025-10-08",
    "status": "present",
    "checkInTime": "09:00:00",
    "checkOutTime": "18:00:00",
    "workHours": 9.0
  }'
```

---

#### **5.6 Request Leave**
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
    "reason": "Medical appointment"
  }'
```

---

#### **5.7 Approve/Reject Leave**
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

## 6. **Users Service**

Base Path: `/users`

### 📌 **Endpoints:**

#### **6.1 List Users**
```bash
GET /users/list
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X GET "http://localhost:4000/users/list" \
  -H "Authorization: Bearer $TOKEN"
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

#### **6.3 Create User**
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
    "password": "securePassword123",
    "displayName": "Property Manager",
    "role": "MANAGER"
  }'
```

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
    "email": "updated.manager@example.com"
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
    "id": 3
  }'
```

---

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
    "userId": 3
  }'
```

---

## 7. **Tasks Service**

Base Path: `/tasks`

### 📌 **Endpoints:**

#### **7.1 List Tasks**
```bash
GET /tasks/list
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)

# List all tasks
curl -X GET "http://localhost:4000/tasks/list" \
  -H "Authorization: Bearer $TOKEN"

# Filter by property and status
curl -X GET "http://localhost:4000/tasks/list?propertyId=1&status=pending" \
  -H "Authorization: Bearer $TOKEN"
```

---

#### **7.2 Create Task**
```bash
POST /tasks/create
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X POST "http://localhost:4000/tasks/create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Fix broken AC in Room 201",
    "description": "AC unit not cooling properly",
    "propertyId": 1,
    "priority": "high",
    "status": "pending",
    "dueDate": "2025-10-10",
    "assignedToStaffId": 1
  }'
```

---

#### **7.3 Update Task**
```bash
PUT /tasks/update
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X PUT "http://localhost:4000/tasks/update" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": 1,
    "status": "in_progress",
    "progress": 50
  }'
```

---

#### **7.4 Delete Task**
```bash
DELETE /tasks/delete
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X DELETE "http://localhost:4000/tasks/delete" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": 1
  }'
```

---

#### **7.5 Assign Task to Staff**
```bash
POST /tasks/assign
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X POST "http://localhost:4000/tasks/assign" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": 1,
    "staffId": 2
  }'
```

---

## 8. **Organizations Service**

Base Path: `/orgs`

### 📌 **Endpoints:**

#### **8.1 Create Organization**
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
    "phone": "+91-1234567890"
  }'
```

---

#### **8.2 Invite User to Organization**
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
    "role": "MANAGER"
  }'
```

---

## 9. **Uploads Service**

Base Path: `/uploads`

### 📌 **Endpoints:**

#### **9.1 Upload File**
```bash
POST /uploads/file
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)

# Upload an image file
FILE_PATH="/path/to/image.jpg"
BASE64_DATA=$(base64 < "$FILE_PATH" | tr -d '\n')

curl -X POST "http://localhost:4000/uploads/file" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"fileData\": \"$BASE64_DATA\",
    \"filename\": \"receipt.jpg\",
    \"mimeType\": \"image/jpeg\"
  }"
```

**Response:**
```json
{
  "fileId": 123,
  "filename": "receipt.jpg",
  "url": "/uploads/download?fileId=123"
}
```

---

#### **9.2 Download File**
```bash
GET /uploads/download
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
FILE_ID=123
curl -X GET "http://localhost:4000/uploads/download?fileId=${FILE_ID}" \
  -H "Authorization: Bearer $TOKEN" \
  -o downloaded_file.jpg
```

---

#### **9.3 Delete File**
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

## 10. **Branding Service**

Base Path: `/branding`

### 📌 **Endpoints:**

#### **10.1 Get Theme**
```bash
GET /branding/theme
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X GET "http://localhost:4000/branding/theme" \
  -H "Authorization: Bearer $TOKEN"
```

---

#### **10.2 Update Theme**
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
    "primaryColor": "#3B82F6",
    "secondaryColor": "#10B981",
    "currency": "INR",
    "dateFormat": "DD/MM/YYYY"
  }'
```

---

#### **10.3 Upload Logo**
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

#### **10.4 Get Logo**
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

## 11. **Analytics Service**

Base Path: `/analytics`

### 📌 **Endpoints:**

#### **11.1 Get Analytics Overview**
```bash
GET /analytics/overview
```

**Request:**
```bash
TOKEN=$(cat /tmp/token.txt)

# Get overall analytics
curl -X GET "http://localhost:4000/analytics/overview" \
  -H "Authorization: Bearer $TOKEN"

# Filter by property and date range
curl -X GET "http://localhost:4000/analytics/overview?propertyId=1&startDate=2025-10-01&endDate=2025-10-31" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 📝 **Common Query Parameters**

### **Filtering Parameters:**

- `propertyId` - Filter by specific property (integer)
- `startDate` - Start date in YYYY-MM-DD format
- `endDate` - End date in YYYY-MM-DD format
- `status` - Filter by status (pending, approved, rejected, etc.)
- `paymentMode` - Filter by payment mode (cash, bank)

### **Pagination Parameters:**

- `page` - Page number (default: 1)
- `limit` - Items per page (default: 50)

---

## 🔧 **Testing Scripts**

### **Complete Test Suite:**

```bash
#!/bin/bash
# Save as test_all_apis.sh

BASE_URL="http://localhost:4000"

# 1. Login
echo "🔐 Step 1: Login..."
RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "shreya@gmail.com", "password": "123456789"}')

TOKEN=$(echo $RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['accessToken'])")
echo "✅ Access token obtained"

# 2. Test Properties
echo "\n📋 Step 2: Testing Properties..."
curl -s -X GET "$BASE_URL/properties" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys, json; data = json.load(sys.stdin); print(f'Properties: {len(data[\"properties\"])} found')"

# 3. Test Finance
echo "\n💰 Step 3: Testing Finance..."
curl -s -X POST "$BASE_URL/finance/revenues" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "propertyId": 1,
    "amountCents": 100000,
    "paymentMode": "cash",
    "description": "Test revenue",
    "source": "room",
    "occurredAt": "2025-10-08T10:00:00.000Z"
  }' \
  | python3 -c "import sys, json; data = json.load(sys.stdin); print(f'Revenue created: ID={data.get(\"id\", \"Failed\")}')"

# 4. Test Reports
echo "\n📊 Step 4: Testing Reports..."
curl -s -X GET "$BASE_URL/reports/monthly-summary?year=2025&month=10&propertyId=1" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys, json; data = json.load(sys.stdin); print(f'Monthly Report: Revenue ₹{data[\"totalRevenue\"]:,.2f}')"

echo "\n✅ All tests completed!"
```

---

## 🎯 **Quick Reference - Common Operations**

### **Authentication Flow:**
```bash
# 1. Login
TOKEN=$(curl -s -X POST "http://localhost:4000/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "shreya@gmail.com", "password": "123456789"}' \
  | python3 -c "import sys, json; print(json.load(sys.stdin)['accessToken'])")

# 2. Use token in subsequent requests
curl -X GET "http://localhost:4000/properties" \
  -H "Authorization: Bearer $TOKEN"
```

### **Create Revenue:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X POST "http://localhost:4000/finance/revenues" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "propertyId": 1,
    "amountCents": 500000,
    "paymentMode": "cash",
    "description": "Room revenue",
    "source": "room",
    "occurredAt": "2025-10-08T14:30:00.000Z"
  }'
```

### **Create Expense:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X POST "http://localhost:4000/finance/expenses" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "propertyId": 1,
    "amountCents": 100000,
    "paymentMode": "cash",
    "description": "Maintenance work",
    "category": "maintenance",
    "expenseDate": "2025-10-08"
  }'
```

### **Get Monthly Report:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X GET "http://localhost:4000/reports/monthly-summary?year=2025&month=10&propertyId=1" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys, json; d=json.load(sys.stdin); print(f'Revenue: ₹{d[\"totalRevenue\"]:,.2f}'); print(f'Expenses: ₹{d[\"totalExpenses\"]:,.2f}'); print(f'Net Income: ₹{d[\"netIncome\"]:,.2f}')"
```

### **Get Quarterly Report:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X GET "http://localhost:4000/reports/quarterly-summary?year=2025&quarter=4&propertyId=1" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys, json; d=json.load(sys.stdin); print(f'{d[\"quarterName\"]} {d[\"year\"]}'); print(f'Revenue: ₹{d[\"totalRevenue\"]:,.2f}'); print(f'Expenses: ₹{d[\"totalExpenses\"]:,.2f}')"
```

### **Get Yearly Report:**
```bash
TOKEN=$(cat /tmp/token.txt)
curl -X GET "http://localhost:4000/reports/yearly-summary?year=2025&propertyId=1" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys, json; d=json.load(sys.stdin); print(f'Year {d[\"year\"]}'); print(f'Revenue: ₹{d[\"totalRevenue\"]:,.2f}'); print(f'Expenses: ₹{d[\"totalExpenses\"]:,.2f}'); print(f'Months with Data: {d[\"monthsWithTransactions\"]}/12')"
```

---

## ⚡ **Status Codes**

- `200 OK` - Request successful
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request parameters
- `401 Unauthorized` - Authentication required or invalid token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

---

## 🔒 **Role-Based Access Control**

### **Admin Privileges:**
- Full access to all endpoints
- Can approve/reject transactions
- Can manage users and roles
- Can access all properties

### **Manager Privileges:**
- Access to assigned properties only
- Can create transactions (requires daily approval)
- Cannot approve their own transactions
- Limited user management

---

## 🌐 **Timezone Information**

**All dates and times use IST (Asia/Kolkata) timezone:**
- Stored as: `timestamp with time zone` or `date` in PostgreSQL
- Displayed as: 24-hour format in IST
- API accepts: ISO 8601 format or YYYY-MM-DD for dates
- Filtering: All date comparisons use IST timezone

**Example:**
- Input: `"2025-10-08T14:30:00.000Z"` (UTC)
- Stored: Converted to IST internally
- Filtered: Using `DATE(occurred_at AT TIME ZONE 'Asia/Kolkata')`
- Displayed: In IST 24-hour format

---

## 📊 **Tested Report Endpoints Summary**

### **✅ Working Endpoints (Tested October 8, 2025):**

| Endpoint | Description | Timezone | Status |
|----------|-------------|----------|--------|
| `/reports/daily-report` | Daily transactions & balances | IST ✅ | Working ✅ |
| `/reports/monthly-report` | Monthly with daily breakdown | IST ✅ | Working ✅ |
| `/reports/monthly-summary` | Monthly financial summary | IST ✅ | Working ✅ |
| `/reports/quarterly-summary` | Quarterly with monthly breakdown | IST ✅ | Working ✅ |
| `/reports/yearly-summary` | Yearly with monthly breakdown | IST ✅ | Working ✅ |
| `/reports/monthly-yearly-report` | Flexible date range report | IST ✅ | Working ✅ |

**Data Consistency Verified:** All report endpoints return identical data for the same time period ✅

---

## 🧪 **Test Data Examples**

### **Test Credentials:**
- **Admin:** shreya@gmail.com / 123456789
- **Role:** ADMIN
- **Org ID:** 2

### **Test Properties:**
- **test1** (ID: 1) - Hotel in Panaji, Goa
- **HostelExp Munroe** (ID: 3) - Hostel

### **Test Transactions (October 2025 - test1):**
- Revenue: ₹6,720.00
- Expenses: ₹1,620.00
- Net Income: ₹5,100.00

---

## 📚 **Additional Resources**

- **Development Guide:** See `DEVELOPMENT.md`
- **Frontend Integration:** See `frontend/src/client.ts` for generated TypeScript client
- **Database Schema:** See migration files in each service's `migrations/` folder

---

## 🛠️ **Troubleshooting**

### **Common Issues:**

1. **401 Unauthorized:**
   - Token expired - Get a fresh token using login
   - Invalid token - Check Bearer token format

2. **403 Forbidden:**
   - Insufficient role permissions
   - Manager trying to access unauthorized property

3. **500 Internal Server Error:**
   - Check backend console logs
   - Verify database connection
   - Check Encore backend is running: `encore run`

### **Backend Status Check:**
```bash
# Check if backend is running
curl -X GET "http://localhost:4000/config/health"

# Expected response: {"status": "healthy"}
```

---

## 12. **Guest Check-in Service** (`/guest-checkin`) ⭐ NEW

Base Path: `/guest-checkin`  
**Features**: Document upload with LLM extraction, Audit logging, Multi-document management

### 📌 **Document Management Endpoints:**

#### **12.1 Upload Guest Document with LLM Extraction**
```bash
POST /guest-checkin/documents/upload
```

**Auth**: Required (Admin, Manager)  
**Rate Limit**: 10 requests/minute per organization

**Request:**
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

**Response:**
```json
{
  "success": true,
  "document": {
    "id": 456,
    "documentType": "aadhaar_front",
    "filename": "aadhaar_front_20251010120530_uuid.jpg",
    "fileSize": 2456789,
    "thumbnailUrl": "/guest-checkin/documents/456/thumbnail",
    "uploadedAt": "2025-10-10T12:05:30Z"
  },
  "extraction": {
    "status": "completed",
    "data": {
      "fullName": {"value": "Ananya Sharma", "confidence": 95, "needsVerification": false},
      "aadharNumber": {"value": "1234 5678 9012", "confidence": 98, "needsVerification": false},
      "address": {"value": "123 Main St", "confidence": 85, "needsVerification": true}
    },
    "overallConfidence": 92,
    "processingTime": 2345
  },
  "message": "Document uploaded and processed successfully"
}
```

#### **12.2 List Guest Documents**
```bash
GET /guest-checkin/:checkInId/documents
```

**Example:**
```bash
curl -X GET "http://localhost:4000/guest-checkin/123/documents" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "documents": [
    {
      "id": 456,
      "documentType": "aadhaar_front",
      "filename": "aadhaar_front_20251010120530_uuid.jpg",
      "extractionStatus": "completed",
      "overallConfidence": 92,
      "isVerified": true,
      "createdAt": "2025-10-10T12:05:30Z"
    }
  ],
  "total": 1
}
```

#### **12.3 Verify Extracted Data**
```bash
POST /guest-checkin/documents/:documentId/verify
```

**Example:**
```bash
curl -X POST "http://localhost:4000/guest-checkin/documents/456/verify" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "correctedData": {
      "address": "123, Rose Villa, MG Road, Bangalore"
    },
    "notes": "Corrected address"
  }'
```

#### **12.4 Delete Document**
```bash
DELETE /guest-checkin/documents/:documentId
```

**Example:**
```bash
curl -X DELETE "http://localhost:4000/guest-checkin/documents/456" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"reason": "Duplicate upload", "hardDelete": false}'
```

#### **12.5 Get Document Statistics**
```bash
GET /guest-checkin/documents/stats
```

**Example:**
```bash
curl -X GET "http://localhost:4000/guest-checkin/documents/stats?startDate=2025-10-01T00:00:00Z&endDate=2025-10-31T23:59:59Z" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "totalDocuments": 1500,
  "byDocumentType": {
    "aadhaar_front": 450,
    "passport": 300,
    "pan_card": 200
  },
  "extractionStats": {
    "completed": 1350,
    "avgConfidence": 89,
    "avgProcessingTime": 2100
  },
  "verificationStats": {
    "verified": 1200,
    "verificationRate": 88.9
  },
  "storageStats": {
    "totalSizeMB": 3072
  }
}
```

### 📌 **Audit Log Endpoints:**

#### **12.6 List Audit Logs**
```bash
GET /guest-checkin/audit-logs
```

**Query Parameters**:
- `startDate`, `endDate`: Date range filter
- `userId`: Filter by user
- `actionType`: Filter by action (create_checkin, view_documents, etc.)
- `guestCheckInId`: Filter by guest
- `limit`, `offset`: Pagination

**Example:**
```bash
curl -X GET "http://localhost:4000/guest-checkin/audit-logs?\
startDate=2025-10-01T00:00:00Z&\
actionType=view_documents&\
limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "logs": [
    {
      "id": 12345,
      "timestamp": "2025-10-10T12:10:00Z",
      "user": {
        "id": 10,
        "email": "manager@hotel.com",
        "role": "MANAGER"
      },
      "action": {
        "type": "view_documents",
        "resourceType": "guest_document",
        "resourceId": 456
      },
      "guest": {
        "checkInId": 123,
        "name": "Ananya Sharma"
      },
      "success": true,
      "durationMs": 234
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

#### **12.7 Export Audit Logs to CSV**
```bash
GET /guest-checkin/audit-logs/export
```

**Example:**
```bash
curl -X GET "http://localhost:4000/guest-checkin/audit-logs/export?\
startDate=2025-10-01T00:00:00Z&\
endDate=2025-10-10T23:59:59Z" \
  -H "Authorization: Bearer $TOKEN" \
  --output audit_logs.csv
```

**Returns**: CSV file with all audit log entries

#### **12.8 Get Audit Summary**
```bash
GET /guest-checkin/audit-logs/summary
```

**Example:**
```bash
curl -X GET "http://localhost:4000/guest-checkin/audit-logs/summary?startDate=2025-10-01T00:00:00Z" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "totalActions": 5000,
  "byActionType": {
    "create_checkin": 500,
    "view_guest_details": 1500,
    "view_documents": 800,
    "download_document": 300
  },
  "securityAlerts": {
    "unauthorizedAttempts": 10,
    "failedActions": 25
  }
}
```

### 📌 **Enhanced Check-in Endpoints:**

#### **12.9 Create Check-in with Documents**
```bash
POST /guest-checkin/create-with-documents
```

**Description**: Create guest check-in and upload documents in one request

**Request:**
```bash
curl -X POST "http://localhost:4000/guest-checkin/create-with-documents" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "propertyId": 1,
    "guestType": "indian",
    "fullName": "Ananya Sharma",
    "email": "ananya@example.com",
    "phone": "+91 9876543210",
    "address": "123 Main St",
    "aadharNumber": "123456789012",
    "dataSource": "aadhaar_scan",
    "documents": [
      {
        "documentType": "aadhaar_front",
        "fileData": "base64_image_data",
        "filename": "aadhaar.jpg",
        "mimeType": "image/jpeg"
      }
    ]
  }'
```

**Response:**
```json
{
  "id": 123,
  "message": "Guest checked in successfully with 1 document(s)",
  "checkInDate": "2025-10-10T12:00:00Z",
  "documents": [
    {
      "id": 456,
      "documentType": "aadhaar_front",
      "extractionStatus": "processing",
      "overallConfidence": 0,
      "filename": "aadhaar_front_20251010120000_uuid.jpg"
    }
  ]
}
```

### 📌 **Supported Document Types:**

- `aadhaar_front` - Aadhaar Card (Front)
- `aadhaar_back` - Aadhaar Card (Back)
- `pan_card` - PAN Card
- `passport` - Passport
- `visa_front` - Visa (Front)
- `visa_back` - Visa (Back)

### 📌 **Audit Action Types:**

- `create_checkin` - Guest check-in created
- `update_checkin` - Guest info updated
- `delete_checkin` - Check-in cancelled
- `checkout_guest` - Guest checked out
- `view_guest_details` - Guest details viewed
- `upload_document` - Document uploaded
- `view_documents` - Documents list viewed
- `view_document` - Single document viewed
- `download_document` - Document downloaded
- `delete_document` - Document deleted
- `verify_document` - Extraction verified
- `query_audit_logs` - Audit logs queried
- `export_audit_logs` - Audit logs exported
- `unauthorized_access_attempt` - Failed access attempt

---

**End of API Documentation**


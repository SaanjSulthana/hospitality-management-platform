# Encore.ts API Parameter Handling Guide

## Introduction

This guide explains how to handle `id` and other parameters in backend APIs when using the Encore.ts framework. It covers the correct way to define endpoints, handle path parameters, and manage request bodies to ensure your APIs are robust and maintainable.

## 1. Defining API Endpoints

### Basic API Definition

```typescript
import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";

export const yourEndpoint = api<RequestType, ResponseType>(
  { auth: true, expose: true, method: "GET", path: "/your-path" },
  async (req) => {
    // Your endpoint logic here
  }
);
```

### Path Parameters

When defining an endpoint with path parameters, use the `:paramName` syntax in the `path` property.

```typescript
export const getExpenseById = api<GetExpenseByIdRequest, GetExpenseByIdResponse>(
  { auth: true, expose: true, method: "GET", path: "/expenses/:id" },
  async (req) => {
    const { id } = req; // Encore automatically extracts path parameters into the request object
    // Your logic here
  }
);
```

### Request and Response Types

Define your request and response types to ensure type safety.

```typescript
export interface GetExpenseByIdRequest {
  id: number; // Path parameter
  // Other request body parameters
}

export interface GetExpenseByIdResponse {
  success: boolean;
  expense: Expense;
}
```

## 2. Handling Different Types of Parameters

### Path Parameters

Path parameters are automatically extracted by Encore and included in the request object.

```typescript
export const updateExpense = api<UpdateExpenseRequest, UpdateExpenseResponse>(
  { auth: true, expose: true, method: "PATCH", path: "/expenses/:id" },
  async (req) => {
    const { id, ...updateData } = req; // Destructure to separate path parameter from body
    // Your logic here
  }
);
```

### Request Body Parameters

Request body parameters are also included in the request object.

```typescript
export const createExpense = api<CreateExpenseRequest, CreateExpenseResponse>(
  { auth: true, expose: true, method: "POST", path: "/expenses" },
  async (req) => {
    const { propertyId, category, amountCents } = req; // All from request body
    // Your logic here
  }
);
```

### Query Parameters

Query parameters are handled similarly to request body parameters.

```typescript
export const listExpenses = api<ListExpensesRequest, ListExpensesResponse>(
  { auth: true, expose: true, method: "GET", path: "/expenses" },
  async (req) => {
    const { propertyId, category, status } = req; // All from query string
    // Your logic here
  }
);
```

## 3. Best Practices

### 1. Consistent Parameter Naming

Ensure that the parameter names in your request type match the names used in the path.

```typescript
export const getExpenseById = api<GetExpenseByIdRequest, GetExpenseByIdResponse>(
  { auth: true, expose: true, method: "GET", path: "/expenses/:id" },
  async (req) => {
    const { id } = req; // Correct
  }
);
```

### 2. Destructuring for Clarity

Use destructuring to separate path parameters from request body parameters for clarity.

```typescript
export const updateExpense = api<UpdateExpenseRequest, UpdateExpenseResponse>(
  { auth: true, expose: true, method: "PATCH", path: "/expenses/:id" },
  async (req) => {
    const { id, ...updateData } = req; // Clear separation
    // Your logic here
  }
);
```

### 3. Type Safety

Always define your request and response types to ensure type safety and better developer experience.

```typescript
export interface UpdateExpenseRequest {
  id: number;
  propertyId?: number;
  category?: string;
  amountCents?: number;
}

export interface UpdateExpenseResponse {
  success: boolean;
  expense: Expense;
}
```

## 4. Common Pitfalls

### 1. Incorrect Path Parameter Handling

**Incorrect:**
```typescript
export const updateExpense = api<UpdateExpenseRequest, UpdateExpenseResponse>(
  { auth: true, expose: true, method: "PATCH", path: "/expenses/:id" },
  async (req, pathParams) => {
    const id = pathParams.id; // This is not how Encore handles path parameters
  }
);
```

**Correct:**
```typescript
export const updateExpense = api<UpdateExpenseRequest, UpdateExpenseResponse>(
  { auth: true, expose: true, method: "PATCH", path: "/expenses/:id" },
  async (req) => {
    const { id } = req; // Encore automatically includes path parameters in the request object
  }
);
```

### 2. Missing Parameter in Request Type

**Incorrect:**
```typescript
export interface UpdateExpenseRequest {
  propertyId?: number;
  category?: string;
  // Missing 'id' for path parameter
}
```

**Correct:**
```typescript
export interface UpdateExpenseRequest {
  id: number; // Include path parameter in request type
  propertyId?: number;
  category?: string;
}
```

## 5. Example: Complete API Endpoint

Here's a complete example of an API endpoint that handles path parameters and request body parameters correctly.

```typescript
import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";

export interface UpdateExpenseRequest {
  id: number; // Path parameter
  propertyId?: number;
  category?: string;
  amountCents?: number;
  description?: string;
}

export interface UpdateExpenseResponse {
  success: boolean;
  expense: Expense;
}

export const updateExpense = api<UpdateExpenseRequest, UpdateExpenseResponse>(
  { auth: true, expose: true, method: "PATCH", path: "/expenses/:id" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }

    const { id, ...updateData } = req; // Separate path parameter from body

    try {
      const updatedExpense = await financeDB.queryRow`
        UPDATE expenses
        SET property_id = COALESCE(${updateData.propertyId}, property_id),
            category = COALESCE(${updateData.category}, category),
            amount_cents = COALESCE(${updateData.amountCents}, amount_cents),
            description = COALESCE(${updateData.description}, description)
        WHERE id = ${id} AND org_id = ${authData.orgId}
        RETURNING *
      `;

      if (!updatedExpense) {
        throw APIError.notFound("Expense not found");
      }

      return {
        success: true,
        expense: updatedExpense,
      };
    } catch (error) {
      console.error('Update expense error:', error);
      throw APIError.internal("Failed to update expense");
    }
  }
);
```

## 6. Conclusion

By following these guidelines, you can ensure that your Encore.ts APIs are robust, maintainable, and free from common pitfalls related to parameter handling. Always remember to define your types, use destructuring for clarity, and let Encore handle the parameter extraction for you.


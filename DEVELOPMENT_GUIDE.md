# 🏗️ Hospitality-ITool Development Guide

## 📋 Table of Contents
1. [Project Architecture Overview](#project-architecture-overview)
2. [Backend Development Rules](#backend-development-rules)
3. [Frontend Development Rules](#frontend-development-rules)
4. [Authentication & Security Rules](#authentication--security-rules)
5. [Database & API Rules](#database--api-rules)
6. [Error Handling Standards](#error-handling-standards)
7. [Testing & Quality Assurance](#testing--quality-assurance)
8. [Deployment & Environment](#deployment--environment)

---

## 🏛️ Project Architecture Overview

### Technology Stack
- **Backend**: Encore.js v1.49.1 + TypeScript + PostgreSQL
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Authentication**: JWT (Access + Refresh tokens)
- **State Management**: React Query (TanStack Query)
- **Database**: PostgreSQL with Encore.js ORM

### Directory Structure
```
hospitality-management-platform/
├── backend/                 # Encore.js backend services
│   ├── auth/               # Authentication services
│   ├── users/              # User management
│   ├── finance/            # Financial services
│   ├── properties/         # Property management
│   └── [new-service]/      # New service modules
├── frontend/               # React frontend
│   ├── components/         # Reusable UI components
│   ├── pages/              # Page components
│   ├── contexts/           # React contexts
│   ├── services/           # API service layer
│   └── lib/                # Utility functions
└── docs/                   # Documentation
```

---

## 🔧 Backend Development Rules

### 1. Service Creation Template
When creating a new service, follow this structure:

```typescript
// backend/[service-name]/[endpoint].ts
import { api } from 'encore.dev/api';
import { getAuthData } from '~encore/auth';
import { requireRole } from '../auth/middleware';
import { APIError } from '../lib/errors';
import { [ServiceName]DB } from './db';

// ✅ CORRECT: Use proper API signature
export const [endpointName] = api.get(
  '/[service-name]/[endpoint]',
  async (req) => {
    const authData = getAuthData();
    
    // Validate authentication
    requireRole("ADMIN")(authData);
    
    try {
      // Your logic here
      const result = await [ServiceName]DB.queryRow(`
        SELECT * FROM [table_name] 
        WHERE org_id = $1
      `, [authData.orgId]);
      
      return result;
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to [action]");
    }
  }
);
```

### 2. API Endpoint Rules
- **ALWAYS** use `getAuthData()` from `~encore/auth`
- **NEVER** use `async (req, authData)` signature
- **ALWAYS** validate user roles with `requireRole()`
- **ALWAYS** wrap main logic in try-catch blocks
- **ALWAYS** use proper error types (`APIError`)

### 3. Database Rules
- **ALWAYS** use `orgId` from `authData` for multi-tenancy
- **ALWAYS** validate input parameters before database queries
- **ALWAYS** use parameterized queries to prevent SQL injection
- **ALWAYS** handle database errors gracefully

### 4. Type Safety Rules
```typescript
// ✅ CORRECT: Define proper types
interface CreateUserRequest {
  email: string;
  password: string;
  displayName: string;
  role: 'ADMIN' | 'MANAGER';
  propertyIds: number[];
}

// ✅ CORRECT: Use proper API signature
export const createUser = api.post<CreateUserRequest, CreateUserResponse>(
  '/users',
  async (req) => {
    const authData = getAuthData();
    // ... implementation
  }
);
```

---

## 🎨 Frontend Development Rules

### 1. Component Structure Template
```typescript
// frontend/pages/[PageName].tsx
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';

export default function [PageName]() {
  const { user, getAuthenticatedBackend } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State management
  const [formData, setFormData] = useState(initialState);
  
  // Data fetching with React Query
  const { data, isLoading, error } = useQuery({
    queryKey: ['[data-key]'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.[service].[method]({});
    },
    enabled: user?.role === 'ADMIN', // Role-based access
    retry: (failureCount, error) => {
      console.error('[Service] query failed:', error);
      return failureCount < 2;
    },
  });
  
  // Mutations
  const mutation = useMutation({
    mutationFn: async (data) => {
      const backend = getAuthenticatedBackend();
      return backend.[service].[method](data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Operation completed successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['[data-key]'] });
    },
    onError: (error: any) => {
      console.error('Operation failed:', error);
      
      // Handle authentication errors
      if (error.message?.includes('Invalid token') || 
          error.message?.includes('Unauthorized')) {
        toast({
          variant: "destructive",
          title: "Session Expired",
          description: "Please log in again to continue.",
        });
        setTimeout(() => window.location.href = '/login', 2000);
        return;
      }
      
      toast({
        variant: "destructive",
        title: "Operation Failed",
        description: error.message || "Please try again.",
      });
    },
  });
  
  // Render logic
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  
  return (
    <div className="space-y-6">
      {/* Your component JSX */}
    </div>
  );
}
```

### 2. Authentication Rules
- **ALWAYS** use `getAuthenticatedBackend()` for API calls
- **ALWAYS** check user roles before rendering sensitive content
- **ALWAYS** handle authentication errors gracefully
- **NEVER** store tokens in component state
- **ALWAYS** use the `useAuth()` context

### 3. State Management Rules
- **ALWAYS** use React Query for server state
- **ALWAYS** use local state for UI state
- **ALWAYS** invalidate queries after mutations
- **ALWAYS** handle loading and error states

### 4. Error Handling Rules
```typescript
// ✅ CORRECT: Comprehensive error handling
const handleError = (error: any) => {
  console.error('Operation failed:', error);
  
  // Authentication errors
  if (error.message?.includes('Invalid token') || 
      error.message?.includes('Unauthorized') ||
      error.message?.includes('401')) {
    toast({
      variant: "destructive",
      title: "Session Expired",
      description: "Please log in again to continue.",
    });
    setTimeout(() => window.location.href = '/login', 2000);
    return;
  }
  
  // Validation errors
  if (error.message?.includes('validation') || 
      error.message?.includes('required')) {
    toast({
      variant: "destructive",
      title: "Validation Error",
      description: error.message,
    });
    return;
  }
  
  // Generic errors
  toast({
    variant: "destructive",
    title: "Operation Failed",
    description: error.message || "Please try again.",
  });
};
```

---

## 🔐 Authentication & Security Rules

### 1. Token Management
- **ALWAYS** validate tokens before use
- **ALWAYS** check token expiry
- **ALWAYS** use refresh tokens for expired access tokens
- **NEVER** store sensitive data in localStorage
- **ALWAYS** clear tokens on logout

### 2. Role-Based Access Control
```typescript
// ✅ CORRECT: Role validation
const { user } = useAuth();

// Check role before rendering
if (user?.role !== 'ADMIN') {
  return <AccessRestricted />;
}

// Check role before API calls
const mutation = useMutation({
  mutationFn: async (data) => {
    if (user?.role !== 'ADMIN') {
      throw new Error('Insufficient permissions');
    }
    const backend = getAuthenticatedBackend();
    return backend.service.method(data);
  },
});
```

### 3. Input Validation
- **ALWAYS** validate input on both frontend and backend
- **ALWAYS** sanitize user inputs
- **ALWAYS** use TypeScript interfaces for type safety
- **NEVER** trust client-side validation alone

---

## 🗄️ Database & API Rules

### 1. Multi-Tenancy
```typescript
// ✅ CORRECT: Always include org_id
const result = await db.queryRow(`
  SELECT * FROM users 
  WHERE id = $1 AND org_id = $2
`, [userId, authData.orgId]);

// ✅ CORRECT: Insert with org_id
await db.exec(`
  INSERT INTO users (email, org_id, created_at) 
  VALUES ($1, $2, NOW())
`, [email, authData.orgId]);
```

### 2. API Response Structure
```typescript
// ✅ CORRECT: Consistent response format
interface APIResponse<T> {
  data: T;
  message?: string;
  timestamp: string;
}

// ✅ CORRECT: Error response format
interface APIError {
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
}
```

### 3. Query Optimization
- **ALWAYS** use indexes on frequently queried columns
- **ALWAYS** limit query results with pagination
- **ALWAYS** use parameterized queries
- **NEVER** use string concatenation for SQL queries

---

## ⚠️ Error Handling Standards

### 1. Backend Error Handling
```typescript
// ✅ CORRECT: Comprehensive error handling
try {
  const result = await db.queryRow(query, params);
  if (!result) {
    throw APIError.notFound("Resource not found");
  }
  return result;
} catch (error) {
  if (error instanceof APIError) {
    throw error;
  }
  
  // Log the error for debugging
  console.error('Database operation failed:', error);
  
  // Return generic error to client
  throw APIError.internal("Operation failed");
}
```

### 2. Frontend Error Handling
```typescript
// ✅ CORRECT: Handle all error types
const handleApiError = (error: any) => {
  // Authentication errors
  if (error.status === 401) {
    handleAuthError();
    return;
  }
  
  // Validation errors
  if (error.status === 400) {
    handleValidationError(error);
    return;
  }
  
  // Server errors
  if (error.status >= 500) {
    handleServerError(error);
    return;
  }
  
  // Generic error
  handleGenericError(error);
};
```

---

## 🧪 Testing & Quality Assurance

### 1. Testing Requirements
- **ALWAYS** test authentication flows
- **ALWAYS** test role-based access control
- **ALWAYS** test error scenarios
- **ALWAYS** test with expired tokens
- **ALWAYS** test multi-tenant isolation

### 2. Code Review Checklist
- [ ] Authentication properly implemented
- [ ] Role-based access control enforced
- [ ] Error handling comprehensive
- [ ] TypeScript types properly defined
- [ ] Database queries use org_id
- [ ] Input validation implemented
- [ ] Loading and error states handled

---

## 🚀 Deployment & Environment

### 1. Environment Variables
```bash
# Backend (.env)
DATABASE_URL=postgresql://user:pass@localhost:5432/db
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
PORT=4000

# Frontend (.env)
VITE_API_URL=http://localhost:4000
VITE_APP_NAME=Hospitality-ITool
```

### 2. Build Commands
```bash
# Backend
cd backend
encore run

# Frontend
cd frontend
npm run dev
npm run build
```

---

## 📚 Common Patterns & Examples

### 1. CRUD Operations Template
```typescript
// Backend: CRUD service
export const listItems = api.get('/items', async (req) => {
  const authData = getAuthData();
  requireRole("ADMIN")(authData);
  
  try {
    const items = await db.queryAll(`
      SELECT * FROM items WHERE org_id = $1
    `, [authData.orgId]);
    
    return { items };
  } catch (error) {
    throw APIError.internal("Failed to fetch items");
  }
});

export const createItem = api.post<CreateItemRequest, CreateItemResponse>(
  '/items',
  async (req) => {
    const authData = getAuthData();
    requireRole("ADMIN")(authData);
    
    try {
      const result = await db.exec(`
        INSERT INTO items (name, org_id, created_at)
        VALUES ($1, $2, NOW())
        RETURNING id, name, created_at
      `, [req.name, authData.orgId]);
      
      return result;
    } catch (error) {
      throw APIError.internal("Failed to create item");
    }
  }
);
```

### 2. Frontend: CRUD Component
```typescript
// Frontend: CRUD component
export default function ItemsPage() {
  const { user, getAuthenticatedBackend } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Data fetching
  const { data: items, isLoading } = useQuery({
    queryKey: ['items'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.items.list({});
    },
    enabled: user?.role === 'ADMIN',
  });
  
  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreateItemRequest) => {
      const backend = getAuthenticatedBackend();
      return backend.items.create(data);
    },
    onSuccess: () => {
      toast({ title: "Item created successfully" });
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
    onError: handleApiError,
  });
  
  // Render
  if (isLoading) return <LoadingSpinner />;
  
  return (
    <div>
      {items?.items.map(item => (
        <ItemCard key={item.id} item={item} />
      ))}
    </div>
  );
}
```

---

## 🚨 Common Mistakes to Avoid

### ❌ DON'T DO THIS
```typescript
// ❌ WRONG: Old API signature
export const endpoint = api.get('/path', async (req, authData) => {
  // This will cause TypeScript errors
});

// ❌ WRONG: Missing authentication
export const endpoint = api.get('/path', async (req) => {
  // No auth validation - security risk
});

// ❌ WRONG: No error handling
export const endpoint = api.get('/path', async (req) => {
  const result = await db.query(query); // No try-catch
  return result;
});

// ❌ WRONG: Missing org_id
const result = await db.query(`
  SELECT * FROM users WHERE id = $1
`, [userId]); // No org_id filter
```

### ✅ DO THIS INSTEAD
```typescript
// ✅ CORRECT: Proper API signature
export const endpoint = api.get('/path', async (req) => {
  const authData = getAuthData();
  requireRole("ADMIN")(authData);
  
  try {
    const result = await db.queryRow(`
      SELECT * FROM users WHERE id = $1 AND org_id = $2
    `, [req.id, authData.orgId]);
    
    return result;
  } catch (error) {
    throw APIError.internal("Operation failed");
  }
});
```

---

## 📖 Additional Resources

- [Encore.js Documentation](https://encore.dev/docs)
- [React Query Documentation](https://tanstack.com/query/latest)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

---

## 🔄 Version History

- **v1.0.0** - Initial development guide
- **v1.1.0** - Added authentication rules and error handling
- **v1.2.0** - Added CRUD templates and common patterns

---

**Remember**: Following these rules will prevent 90% of the common errors we've encountered. When in doubt, refer to this guide or check existing working code for patterns.

export type UserRole = 'ADMIN' | 'MANAGER';

export interface User {
  id: number;
  orgId: number;
  email: string;
  role: UserRole;
  displayName: string;
  createdByUserId?: number;
  createdAt: Date;
  lastLoginAt?: Date;
}

export interface Organization {
  id: number;
  name: string;
  primaryDomain?: string;
  subdomainPrefix?: string;
  themeJson: Record<string, any>;
  createdAt: Date;
}

export interface Session {
  id: number;
  userId: number;
  refreshTokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface AuthData {
  userID: string;
  orgId: number;
  role: UserRole;
  email: string;
  displayName: string;
  createdByUserId?: number;
}

export interface JWTPayload {
  sub: string;
  orgId: number;
  role: UserRole;
  email: string;
  displayName: string;
  createdByUserId?: number;
  exp: number;
  iat: number;
}

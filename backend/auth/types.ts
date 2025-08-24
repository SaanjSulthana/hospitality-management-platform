export type UserRole = 'CORP_ADMIN' | 'REGIONAL_MANAGER' | 'PROPERTY_MANAGER' | 'DEPT_HEAD' | 'STAFF';

export interface User {
  id: number;
  orgId: number;
  email: string;
  role: UserRole;
  displayName: string;
  regionId?: number;
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
  regionId?: number;
}

export interface JWTPayload {
  sub: string;
  orgId: number;
  role: UserRole;
  email: string;
  displayName: string;
  regionId?: number;
  exp: number;
  iat: number;
}

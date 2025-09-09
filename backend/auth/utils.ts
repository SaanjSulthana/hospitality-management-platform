import * as bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { secret } from "encore.dev/config";
import { JWTPayload, User } from "./types";

const jwtSecret = secret("JWTSecret");
const refreshSecret = secret("RefreshSecret");

// Debug: Log secret values (be careful not to log in production)
console.log('=== JWT SECRETS DEBUG ===');
console.log('JWTSecret type:', typeof jwtSecret());
console.log('JWTSecret length:', jwtSecret().length);
console.log('JWTSecret has spaces:', jwtSecret().includes(' '));
console.log('JWTSecret has newlines:', jwtSecret().includes('\n'));
console.log('JWTSecret has tabs:', jwtSecret().includes('\t'));
console.log('JWTSecret first 10 chars:', jwtSecret().substring(0, 10));
console.log('JWTSecret last 10 chars:', jwtSecret().substring(jwtSecret().length - 10));
console.log('JWTSecret value (first 20 chars):', jwtSecret().substring(0, 20));
console.log('RefreshSecret type:', typeof refreshSecret());
console.log('RefreshSecret length:', refreshSecret().length);
console.log('RefreshSecret has spaces:', refreshSecret().includes(' '));
console.log('RefreshSecret value (first 20 chars):', refreshSecret().substring(0, 20));
console.log('=== END JWT SECRETS DEBUG ===');

export async function hashPassword(password: string): Promise<string> {
  try {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  } catch (error) {
    console.error('Password hashing error:', error);
    throw new Error('Failed to hash password');
  }
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
}

export function generateAccessToken(user: User): string {
  try {
    const payload: JWTPayload = {
      sub: user.id.toString(),
      orgId: user.orgId,
      role: user.role,
      email: user.email,
      displayName: user.displayName,
      createdByUserId: user.createdByUserId,
      exp: Math.floor(Date.now() / 1000) + (15 * 60), // 15 minutes
      iat: Math.floor(Date.now() / 1000),
    };
    
    const token = jwt.sign(payload, jwtSecret(), { algorithm: 'HS256' });
    
    // Debug: Log token details
    console.log('=== ACCESS TOKEN DEBUG ===');
    console.log('Token length:', token.length);
    console.log('Token has spaces:', token.includes(' '));
    console.log('Token has newlines:', token.includes('\n'));
    console.log('Token has tabs:', token.includes('\t'));
    console.log('Token first 20 chars:', token.substring(0, 20));
    console.log('Token last 20 chars:', token.substring(token.length - 20));
    console.log('=== END ACCESS TOKEN DEBUG ===');
    
    return token;
  } catch (error) {
    console.error('Access token generation error:', error);
    throw new Error('Failed to generate access token');
  }
}

export function generateRefreshToken(userId: number): string {
  try {
    const payload = {
      sub: userId.toString(),
      type: 'refresh',
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
      iat: Math.floor(Date.now() / 1000),
    };
    
    return jwt.sign(payload, refreshSecret(), { algorithm: 'HS256' });
  } catch (error) {
    console.error('Refresh token generation error:', error);
    throw new Error('Failed to generate refresh token');
  }
}

export function verifyAccessToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, jwtSecret()) as JWTPayload;
  } catch (error) {
    console.error('Access token verification error:', error);
    throw new Error('Invalid access token');
  }
}

export function verifyRefreshToken(token: string): any {
  try {
    return jwt.verify(token, refreshSecret());
  } catch (error) {
    console.error('Refresh token verification error:', error);
    throw new Error('Invalid refresh token');
  }
}

export async function hashRefreshToken(token: string): Promise<string> {
  try {
    const saltRounds = 10;
    return await bcrypt.hash(token, saltRounds);
  } catch (error) {
    console.error('Refresh token hashing error:', error);
    throw new Error('Failed to hash refresh token');
  }
}

export async function verifyRefreshTokenHash(token: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(token, hash);
  } catch (error) {
    console.error('Refresh token hash verification error:', error);
    return false;
  }
}

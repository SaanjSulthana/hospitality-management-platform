import * as bcrypt from "bcrypt";
import * as jwt from "jsonwebtoken";
import { JWTPayload, User } from "./types";

const JWT_SECRET = "mySuperSecretKey123!@#";
const REFRESH_SECRET = "mySuperSecretKey123!@#_refresh";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateAccessToken(user: User): string {
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
  
  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256' });
}

export function generateRefreshToken(userId: number): string {
  const payload = {
    sub: userId.toString(),
    type: 'refresh',
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
    iat: Math.floor(Date.now() / 1000),
  };
  
  return jwt.sign(payload, REFRESH_SECRET, { algorithm: 'HS256' });
}

export function verifyAccessToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}

export function verifyRefreshToken(token: string): any {
  return jwt.verify(token, REFRESH_SECRET);
}

export async function hashRefreshToken(token: string): Promise<string> {
  return bcrypt.hash(token, 10);
}

export async function verifyRefreshTokenHash(token: string, hash: string): Promise<boolean> {
  return bcrypt.compare(token, hash);
}

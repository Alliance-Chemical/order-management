import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const API_KEY = process.env.API_KEY;

export interface AuthUser {
  id: string;
  email: string;
  role: 'admin' | 'operator' | 'viewer';
  permissions: string[];
}

export async function verifyAuth(request: NextRequest): Promise<AuthUser | null> {
  try {
    // Check for API key authentication
    const apiKey = request.headers.get('x-api-key');
    if (apiKey && apiKey === API_KEY) {
      return {
        id: 'api-user',
        email: 'api@system.local',
        role: 'admin',
        permissions: ['read', 'write', 'admin']
      };
    }

    // Check for JWT token
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    return {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role || 'viewer',
      permissions: decoded.permissions || ['read']
    };
  } catch (error) {
    console.error('Auth verification error:', error);
    return null;
  }
}

export async function generateToken(user: Partial<AuthUser>): Promise<string> {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

export function requireAuth(allowedRoles?: string[]) {
  return async function middleware(request: NextRequest) {
    const user = await verifyAuth(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }
    
    // Add user to request headers for downstream use
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', user.id);
    requestHeaders.set('x-user-email', user.email);
    requestHeaders.set('x-user-role', user.role);
    
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  };
}

export function withAuth(handler: Function, allowedRoles?: string[]) {
  return async function (request: NextRequest, ...args: any[]) {
    const user = await verifyAuth(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }
    
    // Pass user to the handler
    return handler(request, { ...args[0], user });
  };
}
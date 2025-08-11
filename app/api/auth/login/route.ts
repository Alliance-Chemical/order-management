import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { generateToken } from '@/middleware/auth';

// Mock user database - replace with actual database
const USERS = [
  {
    id: '1',
    email: 'admin@alliancechemical.com',
    password: '$2a$10$8KqXvXKVUGwM5PMurRlXzO2PqK4yeq1VnfBsfTBNJYmPvPvlKrqVy', // password: admin123
    role: 'admin',
    permissions: ['read', 'write', 'admin']
  },
  {
    id: '2',
    email: 'operator@alliancechemical.com',
    password: '$2a$10$8KqXvXKVUGwM5PMurRlXzO2PqK4yeq1VnfBsfTBNJYmPvPvlKrqVy', // password: admin123
    role: 'operator',
    permissions: ['read', 'write']
  }
];

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }
    
    // Find user
    const user = USERS.find(u => u.email === email);
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }
    
    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }
    
    // Generate token
    const token = await generateToken({
      id: user.id,
      email: user.email,
      role: user.role as any,
      permissions: user.permissions
    });
    
    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        permissions: user.permissions
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    );
  }
}
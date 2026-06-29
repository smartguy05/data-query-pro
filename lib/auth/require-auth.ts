import { NextRequest } from 'next/server';
import { isAuthEnabled } from './config';
import { forbidden } from '@/lib/api/response';

export interface AuthContext {
  userId: string;
  email: string;
  name: string | null;
  isAdmin: boolean;
  groups: string[];
}

export async function getAuthContext(request: NextRequest): Promise<AuthContext | null> {
  if (!isAuthEnabled()) {
    return null;
  }

  // Import next-auth dynamically to avoid issues when not installed/configured
  try {
    const { getToken } = await import('next-auth/jwt');
    const token = await getToken({
      req: request as Parameters<typeof getToken>[0]['req'],
      secret: process.env.AUTH_SECRET,
      // Same TLS-proxy fix as middleware.ts: behind the reverse proxy Next sees
      // the request as http://0.0.0.0:3000, so getToken would look for the
      // non-secure cookie and never match the __Secure- session cookie the
      // handler set (AUTH_URL is https) -> every authenticated API route 401s
      // and the UI shows no connections after a refresh.
      secureCookie: process.env.AUTH_URL?.startsWith('https://') ?? false,
    });

    if (!token) {
      return null;
    }

    return {
      userId: token.userId as string,
      email: token.email || '',
      name: token.name || null,
      isAdmin: token.isAdmin === true,
      groups: (token.groups as string[]) || [],
    };
  } catch {
    return null;
  }
}

export function requireAdmin(auth: AuthContext | null) {
  if (!auth || !auth.isAdmin) {
    throw forbidden('Admin access required');
  }
}

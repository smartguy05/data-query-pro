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
    const token = await getToken({ req: request as Parameters<typeof getToken>[0]['req'] });

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

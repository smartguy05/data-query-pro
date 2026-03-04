import { isAuthEnabled } from '@/lib/auth/config';
import { notFound as notFoundResponse } from '@/lib/api/response';
import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';

function getHandlers() {
  if (!isAuthEnabled()) {
    return {
      GET: () => notFoundResponse('Authentication is not configured'),
      POST: () => notFoundResponse('Authentication is not configured'),
    };
  }

  const { handlers } = NextAuth(authOptions);
  return handlers;
}

const { GET, POST } = getHandlers();
export { GET, POST };

import { isAuthEnabled } from '@/lib/auth/config';
import { notFound as notFoundResponse } from '@/lib/api/response';

async function getHandlers() {
  if (!isAuthEnabled()) {
    return {
      GET: () => notFoundResponse('Authentication is not configured'),
      POST: () => notFoundResponse('Authentication is not configured'),
    };
  }

  const NextAuth = (await import('next-auth')).default;
  const { authOptions } = await import('@/lib/auth/auth-options');
  return NextAuth(authOptions);
}

const handlersPromise = getHandlers();

export async function GET(...args: Parameters<typeof fetch>) {
  const handlers = await handlersPromise;
  return (handlers as { GET: Function }).GET(...args);
}

export async function POST(...args: Parameters<typeof fetch>) {
  const handlers = await handlersPromise;
  return (handlers as { POST: Function }).POST(...args);
}

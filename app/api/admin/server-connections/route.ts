import { NextRequest } from 'next/server';
import { getAuthContext, requireAdmin } from '@/lib/auth/require-auth';
import { successResponse, unauthorized, internalError } from '@/lib/api/response';
import { getServerConfig } from '@/lib/server-config';

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return unauthorized();
    requireAdmin(auth);

    const config = await getServerConfig();
    const connections = config?.connections || [];

    // Return server connections (with sensitive data stripped)
    return successResponse(
      connections.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        description: c.description,
        source: 'server',
      }))
    );
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'status' in error) {
      return error as ReturnType<typeof unauthorized>;
    }
    console.error('[GET /api/admin/server-connections]', error);
    return internalError();
  }
}

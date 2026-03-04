import { NextRequest } from 'next/server';
import { getAuthContext, requireAdmin } from '@/lib/auth/require-auth';
import { successResponse, unauthorized, internalError } from '@/lib/api/response';
import { getAllUsers } from '@/lib/db/repositories/user-repository';

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return unauthorized();
    requireAdmin(auth);

    const users = await getAllUsers();
    return successResponse(
      users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        groups: u.groups,
        isAdmin: u.is_admin,
        createdAt: u.created_at.toISOString(),
      }))
    );
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'status' in error) {
      return error as ReturnType<typeof unauthorized>;
    }
    console.error('[GET /api/admin/users]', error);
    return internalError();
  }
}

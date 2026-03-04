import { NextRequest } from 'next/server';
import { getAuthContext, requireAdmin } from '@/lib/auth/require-auth';
import { successResponse, unauthorized, internalError } from '@/lib/api/response';
import { getAssignmentsForConnection } from '@/lib/db/repositories/sharing-repository';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return unauthorized();
    requireAdmin(auth);

    const { id } = await params;
    const assignments = await getAssignmentsForConnection(id);
    return successResponse(assignments);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'status' in error) {
      return error as ReturnType<typeof unauthorized>;
    }
    console.error('[GET /api/admin/server-connections/[id]/assignments]', error);
    return internalError();
  }
}

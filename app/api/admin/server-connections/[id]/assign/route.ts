import { NextRequest } from 'next/server';
import { getAuthContext, requireAdmin } from '@/lib/auth/require-auth';
import { successResponse, badRequest, unauthorized, internalError } from '@/lib/api/response';
import * as sharingRepo from '@/lib/db/repositories/sharing-repository';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return unauthorized();
    requireAdmin(auth);

    const { id } = await params;
    const body = await request.json();

    if (!body.assignedTo || !body.assignedType) {
      return badRequest('assignedTo and assignedType are required');
    }

    if (!['user', 'group'].includes(body.assignedType)) {
      return badRequest('assignedType must be "user" or "group"');
    }

    await sharingRepo.assignServerConnection(id, body.assignedTo, body.assignedType);
    return successResponse({ assigned: true }, { status: 201 });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'status' in error) {
      return error as ReturnType<typeof unauthorized>;
    }
    console.error('[POST /api/admin/server-connections/[id]/assign]', error);
    return internalError();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return unauthorized();
    requireAdmin(auth);

    const { id } = await params;
    const body = await request.json();

    if (!body.assignedTo || !body.assignedType) {
      return badRequest('assignedTo and assignedType are required');
    }

    const removed = await sharingRepo.removeServerConnectionAssignment(
      id, body.assignedTo, body.assignedType
    );

    return successResponse({ removed });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'status' in error) {
      return error as ReturnType<typeof unauthorized>;
    }
    console.error('[DELETE /api/admin/server-connections/[id]/assign]', error);
    return internalError();
  }
}

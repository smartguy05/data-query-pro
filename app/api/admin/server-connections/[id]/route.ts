import { NextRequest } from 'next/server';
import { getAuthContext, requireAdmin } from '@/lib/auth/require-auth';
import { successResponse, badRequest, notFound, unauthorized, internalError } from '@/lib/api/response';
import { isAuthEnabled } from '@/lib/auth/config';
import * as connRepo from '@/lib/db/repositories/connection-repository';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return unauthorized();
    requireAdmin(auth);

    if (!isAuthEnabled()) {
      return badRequest('Server connections can only be edited when auth is enabled');
    }

    const { id } = await params;
    const body = await request.json();

    const updated = await connRepo.updateServerConnection(id, {
      name: body.name,
      type: body.type,
      host: body.host,
      port: body.port,
      database: body.database,
      username: body.username,
      password: body.password,
      filepath: body.filepath,
      description: body.description,
    });

    if (!updated) return notFound('Server connection not found');
    return successResponse(updated);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'status' in error) {
      return error as ReturnType<typeof unauthorized>;
    }
    console.error('[PUT /api/admin/server-connections/[id]]', error);
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

    if (!isAuthEnabled()) {
      return badRequest('Server connections can only be deleted when auth is enabled');
    }

    const { id } = await params;
    const deleted = await connRepo.deleteServerConnection(id);
    if (!deleted) return notFound('Server connection not found');

    return successResponse({ deleted: true });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'status' in error) {
      return error as ReturnType<typeof unauthorized>;
    }
    console.error('[DELETE /api/admin/server-connections/[id]]', error);
    return internalError();
  }
}

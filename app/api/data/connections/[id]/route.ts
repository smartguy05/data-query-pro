import { NextRequest } from 'next/server';
import { getAuthContext } from '@/lib/auth/require-auth';
import { successResponse, badRequest, unauthorized, notFound, internalError } from '@/lib/api/response';
import * as connRepo from '@/lib/db/repositories/connection-repository';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return unauthorized();

    const { id } = await params;
    const conn = await connRepo.getConnectionById(auth.userId, id);
    if (!conn) return notFound('Connection not found');

    return successResponse(conn);
  } catch (error) {
    console.error('[GET /api/data/connections/[id]]', error);
    return internalError();
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return unauthorized();

    const { id } = await params;
    const body = await request.json();

    // Try normal user connection update first
    let updated = await connRepo.updateConnection(auth.userId, { ...body, id });

    // If not found, try server connection metadata update (status, schemaFileId, vectorStoreId)
    if (!updated) {
      updated = await connRepo.updateServerConnectionMetadata(id, {
        status: body.status,
        schemaFileId: body.schemaFileId,
        vectorStoreId: body.vectorStoreId,
      });
    }

    if (!updated) return notFound('Connection not found or access denied');
    return successResponse(updated);
  } catch (error) {
    console.error('[PUT /api/data/connections/[id]]', error);
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

    const { id } = await params;
    const deleted = await connRepo.deleteConnection(auth.userId, id);
    if (!deleted) return notFound('Connection not found or access denied');

    return successResponse({ deleted: true });
  } catch (error) {
    console.error('[DELETE /api/data/connections/[id]]', error);
    return internalError();
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return unauthorized();

    const { id } = await params;
    const body = await request.json();

    if (body.action === 'duplicate') {
      const original = await connRepo.getConnectionById(auth.userId, id);
      if (!original) return notFound('Connection not found');

      const newId = Date.now().toString();
      const newConn: DatabaseConnection = {
        ...original,
        id: newId,
        name: `${original.name} (Copy)`,
        schemaFileId: undefined,
        vectorStoreId: undefined,
        status: 'disconnected',
        source: 'local',
        createdAt: new Date().toISOString(),
      };

      const created = await connRepo.createConnection(auth.userId, newConn);
      return successResponse(created, { status: 201 });
    }

    return badRequest('Unknown action');
  } catch (error) {
    console.error('[POST /api/data/connections/[id]]', error);
    return internalError();
  }
}

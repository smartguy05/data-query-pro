import { NextRequest } from 'next/server';
import { getAuthContext } from '@/lib/auth/require-auth';
import { successResponse, unauthorized, internalError } from '@/lib/api/response';
import * as schemaRepo from '@/lib/db/repositories/schema-repository';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return unauthorized();

    const { connectionId } = await params;
    const schema = await schemaRepo.getSchemaForConnection(connectionId, auth.userId);
    return successResponse(schema);
  } catch (error) {
    console.error('[GET /api/data/schemas/[connectionId]]', error);
    return internalError();
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return unauthorized();

    const { connectionId } = await params;
    const body = await request.json();
    const schema: Schema = {
      connectionId,
      tables: body.tables || [],
    };

    await schemaRepo.upsertSchema(auth.userId, schema);
    return successResponse({ updated: true });
  } catch (error) {
    console.error('[PUT /api/data/schemas/[connectionId]]', error);
    return internalError();
  }
}

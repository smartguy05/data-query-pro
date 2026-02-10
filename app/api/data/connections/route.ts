import { NextRequest } from 'next/server';
import { getAuthContext } from '@/lib/auth/require-auth';
import { successResponse, badRequest, unauthorized, internalError } from '@/lib/api/response';
import * as connRepo from '@/lib/db/repositories/connection-repository';

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return unauthorized();

    // getConnectionsForUser includes DB-managed server connections
    // Non-admins only see server connections that have a schema uploaded
    const connections = await connRepo.getConnectionsForUser(auth.userId, auth.groups, auth.isAdmin);
    return successResponse(connections);
  } catch (error) {
    console.error('[GET /api/data/connections]', error);
    return internalError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return unauthorized();

    const body = await request.json();
    if (!body || !body.id || !body.name || !body.type) {
      return badRequest('Connection id, name, and type are required');
    }

    const conn = await connRepo.createConnection(auth.userId, body);
    return successResponse(conn, { status: 201 });
  } catch (error) {
    console.error('[POST /api/data/connections]', error);
    return internalError();
  }
}

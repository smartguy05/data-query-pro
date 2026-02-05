import { NextRequest } from 'next/server';
import { getAuthContext } from '@/lib/auth/require-auth';
import { successResponse, badRequest, unauthorized, internalError } from '@/lib/api/response';
import * as connRepo from '@/lib/db/repositories/connection-repository';
import { getAssignedServerConnectionIds } from '@/lib/db/repositories/connection-repository';
import { getServerConfig } from '@/lib/server-config';

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return unauthorized();

    // Get user's own + shared connections from app DB
    const dbConnections = await connRepo.getConnectionsForUser(auth.userId, auth.groups);

    // Get server connections assigned to this user/groups
    const assignedIds = await getAssignedServerConnectionIds(auth.userId, auth.groups);
    let serverConnections: DatabaseConnection[] = [];
    if (assignedIds.length > 0) {
      const config = await getServerConfig();
      if (config?.connections) {
        serverConnections = config.connections.filter(c => assignedIds.includes(c.id));
      }
    }

    return successResponse([...serverConnections, ...dbConnections]);
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

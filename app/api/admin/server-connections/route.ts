import { NextRequest } from 'next/server';
import { getAuthContext, requireAdmin } from '@/lib/auth/require-auth';
import { successResponse, badRequest, unauthorized, internalError } from '@/lib/api/response';
import { isAuthEnabled } from '@/lib/auth/config';
import { getServerConfig } from '@/lib/server-config';
import * as connRepo from '@/lib/db/repositories/connection-repository';

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return unauthorized();
    requireAdmin(auth);

    if (isAuthEnabled()) {
      // Read from DB
      const connections = await connRepo.getAllServerConnections();
      return successResponse(
        connections.map(c => ({
          id: c.id,
          name: c.name,
          type: c.type,
          host: c.host,
          port: c.port,
          database: c.database,
          description: c.description,
          source: 'server',
        }))
      );
    }

    // Fallback: read from config file
    const config = await getServerConfig();
    const connections = config?.connections || [];
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

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return unauthorized();
    requireAdmin(auth);

    if (!isAuthEnabled()) {
      return badRequest('Server connections can only be created via admin UI when auth is enabled');
    }

    const body = await request.json();
    if (!body.name || !body.type || !body.host || !body.database || !body.username) {
      return badRequest('Name, type, host, database, and username are required');
    }

    const conn = await connRepo.createServerConnection({
      name: body.name,
      type: body.type,
      host: body.host,
      port: body.port || '',
      database: body.database,
      username: body.username,
      password: body.password || '',
      filepath: body.filepath,
      description: body.description,
    });

    return successResponse(conn, { status: 201 });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'status' in error) {
      return error as ReturnType<typeof unauthorized>;
    }
    console.error('[POST /api/admin/server-connections]', error);
    return internalError();
  }
}

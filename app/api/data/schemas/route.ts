import { NextRequest } from 'next/server';
import { getAuthContext } from '@/lib/auth/require-auth';
import { successResponse, unauthorized, internalError } from '@/lib/api/response';
import * as schemaRepo from '@/lib/db/repositories/schema-repository';

/**
 * Returns ALL of the user's introspected schemas across every connection and
 * namespace (one entry per (connection, schema)). The client loads these up
 * front and selects the one matching each connection's active schema.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return unauthorized();

    const schemas = await schemaRepo.getAllSchemasForUser(auth.userId);
    return successResponse(schemas);
  } catch (error) {
    console.error('[GET /api/data/schemas]', error);
    return internalError();
  }
}

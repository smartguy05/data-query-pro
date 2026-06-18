import { NextRequest } from 'next/server';
import { getAuthContext } from '@/lib/auth/require-auth';
import { successResponse, unauthorized, badRequest, internalError } from '@/lib/api/response';
import * as correctionRepo from '@/lib/db/repositories/query-correction-repository';
import { CORRECTIONS } from '@/lib/constants';

// GET /api/data/corrections?fingerprint=... — corrections pooled team-wide for a schema fingerprint.
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return unauthorized();

    const fingerprint = request.nextUrl.searchParams.get('fingerprint') || '';
    const corrections = await correctionRepo.getByFingerprint(fingerprint, CORRECTIONS.MAX_POOL_FETCH);
    return successResponse(corrections);
  } catch (error) {
    console.error('[GET /api/data/corrections]', error);
    return internalError();
  }
}

// POST /api/data/corrections — record a captured failed->revised correction into the shared pool.
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return unauthorized();

    const body = await request.json();
    if (!body || !body.id || !body.schemaFingerprint || !body.badSql || !body.goodSql) {
      return badRequest('Correction id, schemaFingerprint, badSql, and goodSql are required');
    }

    await correctionRepo.createCorrection(auth.userId, body);
    return successResponse({ created: true }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/data/corrections]', error);
    return internalError();
  }
}

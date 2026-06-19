import { NextRequest } from 'next/server';
import { getAuthContext } from '@/lib/auth/require-auth';
import { successResponse, unauthorized, internalError } from '@/lib/api/response';
import * as accuracyRepo from '@/lib/db/repositories/query-accuracy-repository';

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return unauthorized();

    const stats = await accuracyRepo.getStats(auth.userId);
    return successResponse(stats);
  } catch (error) {
    console.error('[GET /api/data/query-accuracy]', error);
    return internalError();
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return unauthorized();

    const body = await request.json();
    const totalDelta = Number(body.totalDelta) || 0;
    const successfulDelta = Number(body.successfulDelta) || 0;

    await accuracyRepo.applyDelta(auth.userId, totalDelta, successfulDelta);
    return successResponse({ updated: true });
  } catch (error) {
    console.error('[PUT /api/data/query-accuracy]', error);
    return internalError();
  }
}

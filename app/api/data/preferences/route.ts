import { NextRequest } from 'next/server';
import { getAuthContext } from '@/lib/auth/require-auth';
import { successResponse, unauthorized, internalError } from '@/lib/api/response';
import * as prefRepo from '@/lib/db/repositories/preference-repository';

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return unauthorized();

    const prefs = await prefRepo.getPreferences(auth.userId);
    return successResponse(prefs);
  } catch (error) {
    console.error('[GET /api/data/preferences]', error);
    return internalError();
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return unauthorized();

    const body = await request.json();
    await prefRepo.updatePreferences(auth.userId, {
      currentConnectionId: body.currentConnectionId,
      preferences: body.preferences,
    });
    return successResponse({ updated: true });
  } catch (error) {
    console.error('[PUT /api/data/preferences]', error);
    return internalError();
  }
}

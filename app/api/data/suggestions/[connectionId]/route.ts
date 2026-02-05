import { NextRequest } from 'next/server';
import { getAuthContext } from '@/lib/auth/require-auth';
import { successResponse, unauthorized, internalError } from '@/lib/api/response';
import * as suggestionRepo from '@/lib/db/repositories/suggestion-repository';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return unauthorized();

    const { connectionId } = await params;
    const suggestions = await suggestionRepo.getSuggestions(connectionId, auth.userId);
    return successResponse(suggestions || []);
  } catch (error) {
    console.error('[GET /api/data/suggestions/[connectionId]]', error);
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
    await suggestionRepo.upsertSuggestions(connectionId, auth.userId, body.suggestions || []);
    return successResponse({ updated: true });
  } catch (error) {
    console.error('[PUT /api/data/suggestions/[connectionId]]', error);
    return internalError();
  }
}

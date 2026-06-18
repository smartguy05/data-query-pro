import { NextRequest } from 'next/server';
import { getAuthContext } from '@/lib/auth/require-auth';
import { successResponse, unauthorized, notFound, internalError } from '@/lib/api/response';
import * as correctionRepo from '@/lib/db/repositories/query-correction-repository';

// PUT /api/data/corrections/[id] — edit a correction (author or admin only).
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return unauthorized();

    const { id } = await params;
    const body = await request.json();
    const updated = await correctionRepo.updateCorrection(auth.userId, auth.isAdmin, id, {
      question: body.question,
      error: body.error,
      goodSql: body.goodSql,
    });
    if (!updated) return notFound('Correction not found or access denied');

    return successResponse(updated);
  } catch (error) {
    console.error('[PUT /api/data/corrections/[id]]', error);
    return internalError();
  }
}

// DELETE /api/data/corrections/[id] — remove a correction (author or admin only).
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return unauthorized();

    const { id } = await params;
    const deleted = await correctionRepo.deleteCorrection(auth.userId, auth.isAdmin, id);
    if (!deleted) return notFound('Correction not found or access denied');

    return successResponse({ deleted: true });
  } catch (error) {
    console.error('[DELETE /api/data/corrections/[id]]', error);
    return internalError();
  }
}

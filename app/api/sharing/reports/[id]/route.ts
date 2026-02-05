import { NextRequest } from 'next/server';
import { getAuthContext } from '@/lib/auth/require-auth';
import { successResponse, badRequest, unauthorized, internalError } from '@/lib/api/response';
import * as sharingRepo from '@/lib/db/repositories/sharing-repository';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return unauthorized();

    const { id } = await params;
    const shares = await sharingRepo.getSharesForReport(id);
    return successResponse(shares);
  } catch (error) {
    console.error('[GET /api/sharing/reports/[id]]', error);
    return internalError();
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return unauthorized();

    const { id } = await params;
    const body = await request.json();

    if (!body.sharedWithId || !body.permission) {
      return badRequest('sharedWithId and permission are required');
    }

    const valid = ['view', 'edit'];
    if (!valid.includes(body.permission)) {
      return badRequest(`permission must be one of: ${valid.join(', ')}`);
    }

    const success = await sharingRepo.shareReport(
      id, auth.userId, body.sharedWithId, body.permission
    );

    if (!success) {
      return badRequest('Report not found or you are not the owner');
    }

    return successResponse({ shared: true }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/sharing/reports/[id]]', error);
    return internalError();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return unauthorized();

    const { id } = await params;
    const body = await request.json();

    if (!body.sharedWithId) {
      return badRequest('sharedWithId is required');
    }

    const success = await sharingRepo.removeReportShare(
      id, auth.userId, body.sharedWithId
    );

    if (!success) {
      return badRequest('Share not found or you are not the owner');
    }

    return successResponse({ removed: true });
  } catch (error) {
    console.error('[DELETE /api/sharing/reports/[id]]', error);
    return internalError();
  }
}

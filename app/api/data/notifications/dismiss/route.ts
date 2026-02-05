import { NextRequest } from 'next/server';
import { getAuthContext } from '@/lib/auth/require-auth';
import { successResponse, badRequest, unauthorized, internalError } from '@/lib/api/response';
import * as notifRepo from '@/lib/db/repositories/notification-repository';

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return unauthorized();

    const body = await request.json();
    if (!body.notificationId) {
      return badRequest('notificationId is required');
    }

    await notifRepo.dismissNotification(auth.userId, body.notificationId);
    return successResponse({ dismissed: true });
  } catch (error) {
    console.error('[POST /api/data/notifications/dismiss]', error);
    return internalError();
  }
}

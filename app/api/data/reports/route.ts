import { NextRequest } from 'next/server';
import { getAuthContext } from '@/lib/auth/require-auth';
import { successResponse, badRequest, unauthorized, internalError } from '@/lib/api/response';
import * as reportRepo from '@/lib/db/repositories/report-repository';

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return unauthorized();

    const reports = await reportRepo.getReportsForUser(auth.userId);
    return successResponse(reports);
  } catch (error) {
    console.error('[GET /api/data/reports]', error);
    return internalError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return unauthorized();

    const body = await request.json();
    if (!body || !body.id || !body.name || !body.sql) {
      return badRequest('Report id, name, and sql are required');
    }

    const report = await reportRepo.createReport(auth.userId, body);
    return successResponse(report, { status: 201 });
  } catch (error) {
    console.error('[POST /api/data/reports]', error);
    return internalError();
  }
}

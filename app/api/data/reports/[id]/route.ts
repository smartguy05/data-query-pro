import { NextRequest } from 'next/server';
import { getAuthContext } from '@/lib/auth/require-auth';
import { successResponse, unauthorized, notFound, internalError } from '@/lib/api/response';
import * as reportRepo from '@/lib/db/repositories/report-repository';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return unauthorized();

    const { id } = await params;
    const report = await reportRepo.getReportById(auth.userId, id);
    if (!report) return notFound('Report not found');

    return successResponse(report);
  } catch (error) {
    console.error('[GET /api/data/reports/[id]]', error);
    return internalError();
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return unauthorized();

    const { id } = await params;
    const body = await request.json();
    const updated = await reportRepo.updateReport(auth.userId, { ...body, id });
    if (!updated) return notFound('Report not found or access denied');

    return successResponse(updated);
  } catch (error) {
    console.error('[PUT /api/data/reports/[id]]', error);
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
    const deleted = await reportRepo.deleteReport(auth.userId, id);
    if (!deleted) return notFound('Report not found or access denied');

    return successResponse({ deleted: true });
  } catch (error) {
    console.error('[DELETE /api/data/reports/[id]]', error);
    return internalError();
  }
}

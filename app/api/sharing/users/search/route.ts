import { NextRequest } from 'next/server';
import { getAuthContext } from '@/lib/auth/require-auth';
import { successResponse, badRequest, unauthorized, internalError } from '@/lib/api/response';
import { searchUsers } from '@/lib/db/repositories/user-repository';

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return unauthorized();

    const query = request.nextUrl.searchParams.get('q');
    if (!query || query.length < 2) {
      return badRequest('Search query must be at least 2 characters');
    }

    const users = await searchUsers(query);

    // Return minimal user info for sharing
    const results = users
      .filter(u => u.id !== auth.userId) // Exclude self
      .map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
      }));

    return successResponse(results);
  } catch (error) {
    console.error('[GET /api/sharing/users/search]', error);
    return internalError();
  }
}

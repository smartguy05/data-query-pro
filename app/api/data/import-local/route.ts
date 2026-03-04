import { NextRequest } from 'next/server';
import { getAuthContext } from '@/lib/auth/require-auth';
import { successResponse, badRequest, unauthorized, internalError } from '@/lib/api/response';
import * as connRepo from '@/lib/db/repositories/connection-repository';
import * as schemaRepo from '@/lib/db/repositories/schema-repository';
import * as reportRepo from '@/lib/db/repositories/report-repository';
import * as suggestionRepo from '@/lib/db/repositories/suggestion-repository';
import * as prefRepo from '@/lib/db/repositories/preference-repository';
import * as notifRepo from '@/lib/db/repositories/notification-repository';
import type { SavedReport } from '@/models/saved-report.interface';

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return unauthorized();

    const body = await request.json();
    if (!body) return badRequest('Request body is required');

    const results = {
      connections: 0,
      schemas: 0,
      reports: 0,
      suggestions: 0,
    };

    // Import connections
    if (body.connections && Array.isArray(body.connections)) {
      for (const conn of body.connections) {
        try {
          // Skip server connections - they're managed separately
          if (conn.source === 'server') continue;
          await connRepo.createConnection(auth.userId, conn);
          results.connections++;
        } catch {
          // Connection might already exist, skip
        }
      }
    }

    // Import schemas
    if (body.schemas && Array.isArray(body.schemas)) {
      for (const schema of body.schemas) {
        try {
          await schemaRepo.upsertSchema(auth.userId, schema);
          results.schemas++;
        } catch {
          // Skip failures
        }
      }
    }

    // Import reports
    if (body.reports && Array.isArray(body.reports)) {
      for (const report of body.reports as SavedReport[]) {
        try {
          await reportRepo.createReport(auth.userId, report);
          results.reports++;
        } catch {
          // Skip failures
        }
      }
    }

    // Import suggestions
    if (body.suggestions && typeof body.suggestions === 'object') {
      for (const [connectionId, suggestions] of Object.entries(body.suggestions)) {
        try {
          await suggestionRepo.upsertSuggestions(connectionId, auth.userId, suggestions as unknown[]);
          results.suggestions++;
        } catch {
          // Skip failures
        }
      }
    }

    // Import current connection preference
    if (body.currentConnectionId) {
      try {
        await prefRepo.updatePreferences(auth.userId, {
          currentConnectionId: body.currentConnectionId,
        });
      } catch {
        // Skip failure
      }
    }

    // Import dismissed notifications
    if (body.dismissedNotifications && Array.isArray(body.dismissedNotifications)) {
      for (const notifId of body.dismissedNotifications) {
        try {
          await notifRepo.dismissNotification(auth.userId, notifId);
        } catch {
          // Skip failures
        }
      }
    }

    return successResponse(results, { status: 201 });
  } catch (error) {
    console.error('[POST /api/data/import-local]', error);
    return internalError();
  }
}

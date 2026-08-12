import { type NextRequest } from "next/server"
import { getAuthContext } from "@/lib/auth/require-auth"
import { badRequest, successResponse } from "@/lib/api/response"
import { cancelIntrospection } from "@/lib/schema/introspection-jobs"

/**
 * Cancels a background schema introspection started by
 * POST /api/schema/start-introspection.
 *
 * Introspection is the longest-running operation in the app — it runs several
 * catalog queries per table — and cancellation here is cooperative, checked
 * between tables, so it works on every engine including SQLite.
 *
 * The client learns the outcome by continuing to poll /api/schema/status, which
 * will report status 'cancelled'.
 */
export async function POST(request: NextRequest) {
  // Called for consistency with the other schema routes; introspection jobs are
  // not owned per-user, and a processId is an unguessable server-generated token.
  await getAuthContext(request)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return badRequest("A JSON body containing processId is required")
  }

  const processId = (body as { processId?: unknown } | null)?.processId
  if (typeof processId !== "string" || !processId) {
    return badRequest("processId is required")
  }

  const outcome = cancelIntrospection(processId)

  // 200 for every outcome including not_found: "it already finished" is the
  // ordinary race here, not an error the user should see.
  return successResponse({ status: outcome })
}

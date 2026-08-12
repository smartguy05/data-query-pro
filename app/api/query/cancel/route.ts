import { type NextRequest } from "next/server"
import { getAuthContext } from "@/lib/auth/require-auth"
import { badRequest, forbidden, successResponse } from "@/lib/api/response"
import { cancelQuery, parseQueryId } from "@/lib/database/query-registry"

/**
 * Cancels an in-flight query started by POST /api/query/execute.
 *
 * The client sends the same `queryId` it generated for the execute call. This
 * aborts that query's registered AbortController, which the adapter running the
 * query translates into a real database-level kill (PostgreSQL
 * pg_cancel_backend, MySQL KILL QUERY, SQL Server request cancellation).
 *
 * CSRF: nothing special is needed. validateCSRFToken() in middleware.ts is an
 * Origin-vs-Host check applied to every state-changing route, and a same-origin
 * browser fetch passes it; shouldSkipCSRF() exempts only /api/auth/.
 *
 * LIMITATION — the registry is process-local (see lib/database/query-registry.ts).
 * Behind multiple Next.js instances or on serverless, a cancel may land on an
 * instance that is not running the query and will report 'already_finished' while
 * the query continues. The QUERY_TIMEOUT statement timeouts are the backstop.
 */
export async function POST(request: NextRequest) {
  const auth = await getAuthContext(request)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return badRequest("A JSON body containing queryId is required")
  }

  const raw = (body as { queryId?: unknown } | null)?.queryId
  if (raw === undefined || raw === null) {
    return badRequest("queryId is required")
  }
  const queryId = parseQueryId(raw)
  if (!queryId) {
    return badRequest("Invalid queryId", "INVALID_QUERY_ID")
  }

  // Mirrors the execute route. With auth disabled there is no user identity to
  // scope by, so all queries share the 'anon' namespace — inventing a spoofable
  // client token would only create a false impression of protection. The blast
  // radius is bounded either way: the worst outcome is denying somebody a
  // read-only SELECT.
  const ownerKey = auth ? `user:${auth.userId}` : "anon"
  const outcome = cancelQuery(queryId, ownerKey)

  switch (outcome) {
    case "forbidden":
      return forbidden("Not your query")

    case "not_found":
      // 200, not 404: "the query already finished" is the common benign race, and
      // a 404 would push the client's cancel handler into an error path — and a
      // scary toast — for the single most normal outcome.
      return successResponse({ status: "already_finished" })

    case "not_cancellable":
      return successResponse({
        status: outcome,
        message: "This database cannot stop a query once it has started.",
      })

    default:
      // 'cancelling', not 'cancelled': we have only *requested* the kill. The
      // authoritative outcome is how the execute request itself resolves.
      return successResponse({ status: outcome })
  }
}

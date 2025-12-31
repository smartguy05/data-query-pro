/**
 * API Route Authentication Helper
 *
 * Provides utilities for protecting API routes with authentication
 * and authorization checks.
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getServerStorageService, isMultiUserEnabled } from "@/lib/services/storage";

// User info extracted from the session
export interface AuthUser {
  id: string;
  email: string;
  role: "admin" | "user";
}

// Extended request with user info
export interface AuthenticatedRequest extends NextRequest {
  user: AuthUser;
}

// Options for the withAuth wrapper
export interface WithAuthOptions {
  requireAdmin?: boolean;
  requireConnectionAccess?: string | ((req: NextRequest) => Promise<string | null>);
}

/**
 * Extract user info from request headers (set by middleware)
 * or from the JWT token directly
 */
async function getUserFromRequest(request: NextRequest): Promise<AuthUser | null> {
  // First try to get from headers (set by middleware)
  const userId = request.headers.get("x-user-id");
  const userRole = request.headers.get("x-user-role");
  const userEmail = request.headers.get("x-user-email");

  if (userId && userRole && userEmail) {
    return {
      id: userId,
      email: userEmail,
      role: userRole as "admin" | "user",
    };
  }

  // Fallback to getting token directly
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token || !token.id || !token.role || !token.email) {
    return null;
  }

  return {
    id: token.id as string,
    email: token.email as string,
    role: token.role as "admin" | "user",
  };
}

/**
 * Check if a user has access to a specific connection
 */
async function checkConnectionAccess(
  userId: string,
  connectionId: string,
  userRole: "admin" | "user"
): Promise<boolean> {
  // Admins have access to all connections
  if (userRole === "admin") {
    return true;
  }

  const storage = getServerStorageService();
  return storage.permissions.hasConnectionAccess(connectionId, userId);
}

/**
 * Higher-order function to wrap API route handlers with authentication
 *
 * @param handler - The API route handler function
 * @param options - Authentication options
 * @returns Wrapped handler with auth checks
 *
 * @example
 * // Basic auth required
 * export const POST = withAuth(async (req, { user }) => {
 *   return NextResponse.json({ userId: user.id });
 * });
 *
 * @example
 * // Admin only
 * export const POST = withAuth(
 *   async (req, { user }) => {
 *     return NextResponse.json({ admin: true });
 *   },
 *   { requireAdmin: true }
 * );
 *
 * @example
 * // Require connection access
 * export const POST = withAuth(
 *   async (req, { user }) => {
 *     return NextResponse.json({ success: true });
 *   },
 *   {
 *     requireConnectionAccess: async (req) => {
 *       const body = await req.clone().json();
 *       return body.connectionId;
 *     }
 *   }
 * );
 */
export function withAuth<T = unknown>(
  handler: (
    request: NextRequest,
    context: { user: AuthUser; params?: T }
  ) => Promise<NextResponse>,
  options: WithAuthOptions = {}
) {
  return async (
    request: NextRequest,
    context?: { params?: T }
  ): Promise<NextResponse> => {
    // If multi-user mode is disabled, create a mock user and proceed
    if (!isMultiUserEnabled()) {
      const mockUser: AuthUser = {
        id: "local-user",
        email: "local@localhost",
        role: "admin",
      };
      return handler(request, { user: mockUser, params: context?.params });
    }

    // Get user from request
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }

    // Check admin requirement
    if (options.requireAdmin && user.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden", message: "Admin access required" },
        { status: 403 }
      );
    }

    // Check connection access requirement
    if (options.requireConnectionAccess) {
      let connectionId: string | null = null;

      if (typeof options.requireConnectionAccess === "function") {
        connectionId = await options.requireConnectionAccess(request);
      } else {
        connectionId = options.requireConnectionAccess;
      }

      if (connectionId) {
        const hasAccess = await checkConnectionAccess(
          user.id,
          connectionId,
          user.role
        );

        if (!hasAccess) {
          return NextResponse.json(
            {
              error: "Forbidden",
              message: "You do not have access to this connection",
            },
            { status: 403 }
          );
        }
      }
    }

    // Call the handler with user info
    return handler(request, { user, params: context?.params });
  };
}

/**
 * Helper to extract connection ID from request body
 * Use with requireConnectionAccess option
 */
export async function getConnectionIdFromBody(
  request: NextRequest
): Promise<string | null> {
  try {
    const body = await request.clone().json();
    return body.connectionId || body.connection?.id || null;
  } catch {
    return null;
  }
}

/**
 * Helper to get the current user from an API route
 * Returns null if not authenticated or multi-user mode is disabled
 */
export async function getCurrentUser(
  request: NextRequest
): Promise<AuthUser | null> {
  if (!isMultiUserEnabled()) {
    return {
      id: "local-user",
      email: "local@localhost",
      role: "admin",
    };
  }

  return getUserFromRequest(request);
}

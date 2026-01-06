import { NextRequest } from 'next/server';

/**
 * HTTP methods that require CSRF protection (state-changing operations)
 */
const CSRF_PROTECTED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Validates that the request origin matches the host.
 * This provides protection against CSRF attacks by ensuring requests
 * come from the same origin.
 *
 * @param request - The incoming Next.js request
 * @returns true if the request is safe, false if it should be blocked
 */
export function validateCSRFToken(request: NextRequest): boolean {
  // Skip validation for safe methods (GET, HEAD, OPTIONS)
  if (!CSRF_PROTECTED_METHODS.includes(request.method)) {
    return true;
  }

  // Get the origin and host headers
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');

  // If no origin header (e.g., same-origin request from form), allow it
  // This is safe because browsers send Origin header for cross-origin requests
  if (!origin) {
    return true;
  }

  // Host header is required for validation
  if (!host) {
    return false;
  }

  try {
    const originUrl = new URL(origin);
    const originHost = originUrl.host;

    // Check if origin host matches the request host
    // This handles both direct matches and subdomain scenarios
    return originHost === host || originHost.endsWith(`.${host}`);
  } catch {
    // Invalid origin URL
    return false;
  }
}

/**
 * Generates a secure random CSRF token.
 * This can be used for double-submit cookie pattern if needed in the future.
 *
 * @returns A random UUID token
 */
export function generateCSRFToken(): string {
  return crypto.randomUUID();
}

/**
 * Checks if a path should skip CSRF validation.
 * Some API routes may need to be exempt (e.g., webhooks with their own auth).
 *
 * @param pathname - The request pathname
 * @returns true if the path should skip CSRF validation
 */
export function shouldSkipCSRF(pathname: string): boolean {
  // Add any paths that should be exempt from CSRF protection
  const exemptPaths = [
    // Webhooks typically have their own authentication
    // '/api/webhooks/',
  ];

  return exemptPaths.some(path => pathname.startsWith(path));
}

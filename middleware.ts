import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { validateCSRFToken, shouldSkipCSRF } from '@/lib/csrf';

/**
 * Security headers to add to all responses.
 * These protect against common web vulnerabilities.
 */
const SECURITY_HEADERS = {
  // Prevent clickjacking attacks by disallowing framing
  'X-Frame-Options': 'DENY',

  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',

  // Enable XSS filtering in older browsers
  'X-XSS-Protection': '1; mode=block',

  // Control referrer information sent with requests
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // Restrict browser permissions
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

/**
 * Content Security Policy header.
 * This controls which resources the browser can load.
 */
const CSP_DIRECTIVES = [
  // Default to only allowing same-origin resources
  "default-src 'self'",

  // Scripts: self, inline (for Next.js), and eval (for some libraries)
  // Note: 'unsafe-inline' and 'unsafe-eval' are needed for Next.js dev mode
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",

  // Styles: self and inline (for styled-components, Tailwind, etc.)
  "style-src 'self' 'unsafe-inline'",

  // Images: self, data URIs (for inline images), and blob (for generated images)
  "img-src 'self' data: blob:",

  // Fonts: self and data URIs
  "font-src 'self' data:",

  // Connect to self and OpenAI API
  "connect-src 'self' https://api.openai.com",

  // Allow workers from self
  "worker-src 'self' blob:",

  // Media: self only
  "media-src 'self'",

  // Objects (plugins): none
  "object-src 'none'",

  // Frame ancestors: none (prevents framing)
  "frame-ancestors 'none'",

  // Form actions: self only
  "form-action 'self'",

  // Base URI: self only
  "base-uri 'self'",
];

/**
 * Middleware function that runs on every request.
 * Adds security headers and validates CSRF tokens for API routes.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check CSRF for API routes
  if (pathname.startsWith('/api/')) {
    // Skip CSRF validation for exempt paths
    if (!shouldSkipCSRF(pathname)) {
      if (!validateCSRFToken(request)) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'CSRF_VALIDATION_FAILED',
              message: 'Invalid request origin',
            },
          },
          { status: 403 }
        );
      }
    }
  }

  // Create response and add security headers
  const response = NextResponse.next();

  // Add all security headers
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Add CSP header
  response.headers.set('Content-Security-Policy', CSP_DIRECTIVES.join('; '));

  return response;
}

/**
 * Configure which paths the middleware runs on.
 * Excludes static files and images for performance.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

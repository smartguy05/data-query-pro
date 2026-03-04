import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { validateCSRFToken, shouldSkipCSRF } from '@/lib/csrf';

const AUTH_ENABLED =
  !!process.env.AUTH_OIDC_ISSUER &&
  !!process.env.AUTH_OIDC_CLIENT_ID &&
  !!process.env.AUTH_OIDC_CLIENT_SECRET;

const PUBLIC_PATHS = [
  '/landing',
  '/auth/login',
  '/api/auth/',
  '/api/config/auth-status',
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname.startsWith(p));
}

const SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

function getCSPDirectives(): string[] {
  const directives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.openai.com",
    "worker-src 'self' blob:",
    "media-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
  ];

  // Add Authentik issuer to form-action if auth is enabled
  const issuer = process.env.AUTH_OIDC_ISSUER;
  if (AUTH_ENABLED && issuer) {
    try {
      const issuerOrigin = new URL(issuer).origin;
      directives.push(`form-action 'self' ${issuerOrigin}`);
    } catch {
      directives.push("form-action 'self'");
    }
  } else {
    directives.push("form-action 'self'");
  }

  return directives;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Auth check (when auth is enabled)
  if (AUTH_ENABLED && !isPublicPath(pathname)) {
    try {
      const { getToken } = await import('next-auth/jwt');
      const token = await getToken({
        req: request,
        secret: process.env.AUTH_SECRET,
      });

      if (!token) {
        // For API routes, return 401
        if (pathname.startsWith('/api/')) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'UNAUTHORIZED',
                message: 'Authentication required',
              },
            },
            { status: 401 }
          );
        }
        // For page routes, redirect to login
        const loginUrl = new URL('/auth/login', request.url);
        loginUrl.searchParams.set('callbackUrl', request.url);
        return NextResponse.redirect(loginUrl);
      }
    } catch (error) {
      console.error('[middleware] Auth check failed:', error);
    }
  }

  // CSRF check for API routes (skip for Auth.js routes which handle their own CSRF)
  if (pathname.startsWith('/api/')) {
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

  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  response.headers.set('Content-Security-Policy', getCSPDirectives().join('; '));

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

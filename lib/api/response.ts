/**
 * Standardized API response utilities.
 *
 * Provides consistent response formatting across all API routes,
 * making it easier for clients to handle responses uniformly.
 */

import { NextResponse } from "next/server";

/**
 * Standard API response structure.
 */
export interface ApiResponse<T = unknown> {
  /** Whether the request was successful */
  success: boolean;
  /** The response data (present on success) */
  data?: T;
  /** Error details (present on failure) */
  error?: {
    code: string;
    message: string;
  };
  /** Optional metadata */
  meta?: Record<string, unknown>;
}

/**
 * Options for response creation.
 */
export interface ResponseOptions {
  /** HTTP status code (defaults to 200 for success, 500 for error) */
  status?: number;
  /** Additional headers to include */
  headers?: Record<string, string>;
  /** Optional metadata to include in response */
  meta?: Record<string, unknown>;
}

/**
 * Creates a successful API response.
 *
 * @param data - The response data
 * @param options - Optional response configuration
 * @returns NextResponse with standardized success format
 *
 * @example
 * return successResponse({ users: [...] });
 *
 * @example
 * return successResponse(
 *   { id: "123" },
 *   { status: 201, meta: { created: true } }
 * );
 */
export function successResponse<T>(
  data: T,
  options: ResponseOptions = {}
): NextResponse<ApiResponse<T>> {
  const { status = 200, headers = {}, meta } = options;

  const body: ApiResponse<T> = {
    success: true,
    data,
  };

  if (meta) {
    body.meta = meta;
  }

  return NextResponse.json(body, {
    status,
    headers,
  });
}

/**
 * Creates an error API response.
 *
 * @param code - Error code for programmatic handling
 * @param message - Human-readable error message
 * @param options - Optional response configuration
 * @returns NextResponse with standardized error format
 *
 * @example
 * return errorResponse("NOT_FOUND", "User not found", { status: 404 });
 */
export function errorResponse(
  code: string,
  message: string,
  options: ResponseOptions = {}
): NextResponse<ApiResponse> {
  const { status = 500, headers = {}, meta } = options;

  const body: ApiResponse = {
    success: false,
    error: {
      code,
      message,
    },
  };

  if (meta) {
    body.meta = meta;
  }

  return NextResponse.json(body, {
    status,
    headers,
  });
}

// ============================================================================
// Common Error Responses
// ============================================================================

/**
 * Returns a 400 Bad Request response.
 *
 * @param message - Error message (default: "Bad request")
 * @param code - Error code (default: "BAD_REQUEST")
 */
export function badRequest(
  message = "Bad request",
  code = "BAD_REQUEST"
): NextResponse<ApiResponse> {
  return errorResponse(code, message, { status: 400 });
}

/**
 * Returns a 401 Unauthorized response.
 *
 * @param message - Error message (default: "Unauthorized")
 * @param code - Error code (default: "UNAUTHORIZED")
 */
export function unauthorized(
  message = "Unauthorized",
  code = "UNAUTHORIZED"
): NextResponse<ApiResponse> {
  return errorResponse(code, message, { status: 401 });
}

/**
 * Returns a 403 Forbidden response.
 *
 * @param message - Error message (default: "Forbidden")
 * @param code - Error code (default: "FORBIDDEN")
 */
export function forbidden(
  message = "Forbidden",
  code = "FORBIDDEN"
): NextResponse<ApiResponse> {
  return errorResponse(code, message, { status: 403 });
}

/**
 * Returns a 404 Not Found response.
 *
 * @param message - Error message (default: "Not found")
 * @param code - Error code (default: "NOT_FOUND")
 */
export function notFound(
  message = "Not found",
  code = "NOT_FOUND"
): NextResponse<ApiResponse> {
  return errorResponse(code, message, { status: 404 });
}

/**
 * Returns a 429 Too Many Requests response.
 *
 * @param message - Error message (default: "Rate limit exceeded")
 * @param meta - Optional metadata (e.g., resetTime, limit, remaining)
 */
export function rateLimited(
  message = "Rate limit exceeded",
  meta?: Record<string, unknown>
): NextResponse<ApiResponse> {
  return errorResponse("RATE_LIMITED", message, { status: 429, meta });
}

/**
 * Returns a 500 Internal Server Error response.
 *
 * @param message - Error message (default: "Internal server error")
 * @param code - Error code (default: "INTERNAL_ERROR")
 */
export function internalError(
  message = "Internal server error",
  code = "INTERNAL_ERROR"
): NextResponse<ApiResponse> {
  return errorResponse(code, message, { status: 500 });
}

/**
 * Returns a 503 Service Unavailable response.
 *
 * @param message - Error message (default: "Service unavailable")
 * @param code - Error code (default: "SERVICE_UNAVAILABLE")
 */
export function serviceUnavailable(
  message = "Service unavailable",
  code = "SERVICE_UNAVAILABLE"
): NextResponse<ApiResponse> {
  return errorResponse(code, message, { status: 503 });
}

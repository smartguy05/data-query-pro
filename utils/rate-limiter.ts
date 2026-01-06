import { type NextRequest } from "next/server";

interface RateLimitInfo {
  count: number;
  windowStart: number;
}

// In-memory store for rate limiting
// Key: IP address, Value: request count and window start time
const rateLimitStore = new Map<string, RateLimitInfo>();

const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Extracts the client IP address from the request headers
 * Checks x-forwarded-for first, then falls back to other headers
 */
export function getClientIP(request: NextRequest): string {
  // Check x-forwarded-for header (standard for proxied requests)
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(",")[0].trim();
  }

  // Fallback to other common headers
  const realIP = request.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }

  // Last resort - use a placeholder (not ideal but prevents crashes)
  return "unknown";
}

/**
 * Checks if the user has provided their own OpenAI API key
 * User keys are sent in the x-user-openai-key header
 */
export function hasUserProvidedKey(request: NextRequest): boolean {
  const userKey = request.headers.get("x-user-openai-key");
  return !!userKey && userKey.length > 0;
}

/**
 * Gets the OpenAI API key to use for the request
 * Returns user-provided key if available, otherwise returns server key
 */
export function getOpenAIKey(request: NextRequest): string | null {
  const userKey = request.headers.get("x-user-openai-key");
  if (userKey && userKey.length > 0) {
    return userKey;
  }
  return process.env.OPENAI_API_KEY || null;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetTime?: number;
}

/**
 * Checks if a request should be rate limited
 * Returns an object with allowed status and remaining count
 *
 * Rate limiting is skipped if:
 * - DEMO_RATE_LIMIT is not set
 * - User has provided their own API key
 */
export function checkRateLimit(request: NextRequest): RateLimitResult {
  // Check if rate limiting is enabled
  const rateLimitStr = process.env.DEMO_RATE_LIMIT;
  if (!rateLimitStr || rateLimitStr === "") {
    // Rate limiting disabled
    return {
      allowed: true,
      remaining: Infinity,
      limit: Infinity,
    };
  }

  const rateLimit = parseInt(rateLimitStr, 10);
  if (isNaN(rateLimit) || rateLimit <= 0) {
    // Invalid rate limit configuration, disable rate limiting
    return {
      allowed: true,
      remaining: Infinity,
      limit: Infinity,
    };
  }

  // Skip rate limiting if user provided their own key
  if (hasUserProvidedKey(request)) {
    return {
      allowed: true,
      remaining: Infinity,
      limit: rateLimit, // Still return the limit for informational purposes
    };
  }

  // Get client IP
  const clientIP = getClientIP(request);
  const now = Date.now();

  // Get or initialize rate limit info for this IP
  let info = rateLimitStore.get(clientIP);

  if (!info) {
    // First request from this IP
    info = {
      count: 0,
      windowStart: now,
    };
    rateLimitStore.set(clientIP, info);
  }

  // Check if the window has expired
  const windowAge = now - info.windowStart;
  if (windowAge >= WINDOW_MS) {
    // Reset the window
    info.count = 0;
    info.windowStart = now;
  }

  // Check if limit is exceeded
  if (info.count >= rateLimit) {
    const resetTime = info.windowStart + WINDOW_MS;
    return {
      allowed: false,
      remaining: 0,
      limit: rateLimit,
      resetTime,
    };
  }

  // Increment the count
  info.count += 1;
  const remaining = rateLimit - info.count;

  return {
    allowed: true,
    remaining,
    limit: rateLimit,
  };
}

/**
 * Cleanup function to remove expired entries from the rate limit store
 * Should be called periodically to prevent memory leaks
 */
export function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [ip, info] of rateLimitStore.entries()) {
    const windowAge = now - info.windowStart;
    if (windowAge >= WINDOW_MS && info.count === 0) {
      rateLimitStore.delete(ip);
    }
  }
}

// Run cleanup every hour
setInterval(cleanupRateLimitStore, 60 * 60 * 1000);

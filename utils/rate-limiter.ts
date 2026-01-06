import { type NextRequest } from "next/server";
import { IS_VERCEL, IS_CLOUDFLARE, isTrustedProxy } from "@/lib/config/trusted-proxies";

interface RateLimitInfo {
  count: number;
  windowStart: number;
}

// In-memory store for rate limiting
// Key: IP address, Value: request count and window start time
const rateLimitStore = new Map<string, RateLimitInfo>();

const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Extracts the client IP address from the request headers securely.
 *
 * Security considerations:
 * - x-forwarded-for can be spoofed by clients, so we only trust it from known proxies
 * - Vercel provides a verified x-vercel-forwarded-for header
 * - Cloudflare provides a verified cf-connecting-ip header
 * - Falls back to a hash of user-agent to provide some differentiation
 */
export function getClientIP(request: NextRequest): string {
  // On Vercel, use their verified header
  if (IS_VERCEL) {
    const vercelIP = request.headers.get('x-vercel-forwarded-for');
    if (vercelIP) {
      // Vercel's header is already verified
      return vercelIP.split(',')[0].trim();
    }
  }

  // On Cloudflare, use their verified header
  if (IS_CLOUDFLARE) {
    const cfIP = request.headers.get('cf-connecting-ip');
    if (cfIP) {
      // Cloudflare's header is already verified
      return cfIP.trim();
    }
  }

  // Get the direct connection IP (if available via Next.js)
  // This is the IP of whoever is directly connecting to us
  const nextIP = request.ip;
  if (nextIP) {
    // Check if the direct connection is from a trusted proxy
    if (isTrustedProxy(nextIP)) {
      // Only trust forwarded headers from known proxies
      const forwardedFor = request.headers.get("x-forwarded-for");
      if (forwardedFor) {
        return forwardedFor.split(",")[0].trim();
      }

      const realIP = request.headers.get("x-real-ip");
      if (realIP) {
        return realIP.trim();
      }
    }

    // Direct connection is not from a trusted proxy, use it directly
    return nextIP;
  }

  // Fallback: Try to get real IP from x-real-ip header set by reverse proxy
  // This is less secure but better than completely failing
  const realIP = request.headers.get("x-real-ip");
  if (realIP) {
    return realIP.trim();
  }

  // Last resort: Create a fingerprint from user-agent and other headers
  // This provides some differentiation but can be bypassed
  const userAgent = request.headers.get("user-agent") || "";
  const acceptLanguage = request.headers.get("accept-language") || "";
  const fingerprint = `fp_${hashString(userAgent + acceptLanguage)}`;

  return fingerprint;
}

/**
 * Simple hash function for creating fingerprints.
 * Not cryptographically secure, just for differentiation.
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
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
 * Cleanup function to remove expired entries from the rate limit store.
 * Removes entries that have exceeded the window period, regardless of count.
 * This prevents unbounded memory growth.
 */
export function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [ip, info] of rateLimitStore.entries()) {
    const windowAge = now - info.windowStart;
    // Remove any entry that's older than the window period
    // Even if they have counts, their window has expired
    if (windowAge >= WINDOW_MS) {
      rateLimitStore.delete(ip);
    }
  }
}

// Run cleanup every hour
setInterval(cleanupRateLimitStore, CLEANUP_INTERVAL_MS);

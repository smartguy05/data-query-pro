/**
 * Trusted proxy configuration for rate limiting.
 *
 * When behind a reverse proxy (nginx, HAProxy, Vercel, etc.),
 * the client IP is typically in x-forwarded-for header.
 * However, this header can be spoofed by clients, so we only
 * trust it when the request comes from a known proxy IP.
 */

/**
 * List of trusted proxy IP addresses/ranges.
 * Set via TRUSTED_PROXIES environment variable (comma-separated).
 *
 * Example: TRUSTED_PROXIES=10.0.0.1,10.0.0.2,192.168.1.0/24
 *
 * When empty, we fall back to less secure but functional defaults.
 */
export const TRUSTED_PROXIES: string[] = (() => {
  const proxies = process.env.TRUSTED_PROXIES;
  if (!proxies) return [];
  return proxies.split(',').map(p => p.trim()).filter(Boolean);
})();

/**
 * Whether we're running on Vercel.
 * Vercel provides a verified x-vercel-forwarded-for header.
 */
export const IS_VERCEL = !!process.env.VERCEL;

/**
 * Whether we're running on Cloudflare.
 * Cloudflare provides a verified cf-connecting-ip header.
 */
export const IS_CLOUDFLARE = !!process.env.CF_CONNECTING_IP;

/**
 * Whether we're in production environment.
 * In production, we're stricter about IP validation.
 */
export const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/**
 * Checks if an IP address is in the trusted proxy list.
 * Currently supports exact matches only.
 *
 * @param ip - The IP address to check
 * @returns true if the IP is a trusted proxy
 */
export function isTrustedProxy(ip: string): boolean {
  if (TRUSTED_PROXIES.length === 0) {
    return false;
  }

  // Simple exact match for now
  // Could be extended to support CIDR ranges
  return TRUSTED_PROXIES.includes(ip);
}

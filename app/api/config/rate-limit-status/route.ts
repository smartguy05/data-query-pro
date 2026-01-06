import { NextResponse } from "next/server";

/**
 * GET /api/config/rate-limit-status
 * Returns whether rate limiting is enabled on the server
 */
export async function GET() {
  const rateLimitStr = process.env.DEMO_RATE_LIMIT;
  const isEnabled =
    !!rateLimitStr &&
    rateLimitStr !== "" &&
    !isNaN(parseInt(rateLimitStr, 10)) &&
    parseInt(rateLimitStr, 10) > 0;

  return NextResponse.json({
    rateLimitEnabled: isEnabled,
    limit: isEnabled ? parseInt(rateLimitStr!, 10) : null,
  });
}

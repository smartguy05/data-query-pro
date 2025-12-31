/**
 * NextAuth.js API Route Handler
 *
 * This route handles all authentication requests including:
 * - /api/auth/signin - Sign in page
 * - /api/auth/signout - Sign out
 * - /api/auth/callback/* - OAuth callbacks
 * - /api/auth/session - Session data
 */

import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth/auth.config";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

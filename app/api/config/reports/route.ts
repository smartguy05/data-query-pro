import { NextResponse } from "next/server";
import { getServerReports } from "@/lib/server-config";
import { isAuthEnabled } from "@/lib/auth/config";

export const dynamic = "force-dynamic";

/**
 * GET /api/config/reports
 *
 * Reads shared saved reports from a server-side config file (config/reports.json).
 * This lets administrators deploy pre-configured reports that are available to all
 * users, mirroring how config/databases.json ships shared connections.
 *
 * Reports are returned marked with source: "server" so the UI can treat them as
 * read-only (no edit/delete) and merge them fresh on every load.
 *
 * A report's connectionId must match the id of a connection in config/databases.json
 * for it to resolve in the UI.
 *
 * When auth is enabled, this returns an empty array (config files are not used in auth mode).
 *
 * Config file location: /config/reports.json in the project root
 */
export async function GET() {
  try {
    if (isAuthEnabled()) {
      return NextResponse.json({
        success: true,
        reports: [],
      });
    }

    const reports = await getServerReports();

    if (!reports) {
      return NextResponse.json({
        success: true,
        reports: [],
      });
    }

    const serverReports = reports.map((report) => ({
      ...report,
      source: "server" as const,
    }));

    return NextResponse.json({
      success: true,
      reports: serverReports,
    });
  } catch (error) {
    console.error("Error reading server reports config:", error);
    return NextResponse.json(
      {
        error: "Failed to read server reports configuration",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

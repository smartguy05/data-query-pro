import { type NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-auth";
import { getServerStorageService } from "@/lib/services/storage";

export const PATCH = withAuth(
  async (request: NextRequest, { user, params }) => {
    try {
      const resolvedParams = await params;
      const reportId = resolvedParams?.id as string;

      if (!reportId) {
        return NextResponse.json(
          { error: "Report ID is required" },
          { status: 400 }
        );
      }

      const body = await request.json();
      const { isShared } = body;

      if (typeof isShared !== "boolean") {
        return NextResponse.json(
          { error: "isShared must be a boolean" },
          { status: 400 }
        );
      }

      const storage = getServerStorageService();

      // Get the report to verify ownership
      const report = await storage.reports.getReport(reportId, user.id);
      if (!report) {
        return NextResponse.json(
          { error: "Report not found" },
          { status: 404 }
        );
      }

      // Only the report owner can share/unshare it
      if (report.createdBy && report.createdBy !== user.id && user.role !== "admin") {
        return NextResponse.json(
          { error: "Only the report owner can change sharing settings" },
          { status: 403 }
        );
      }

      // Update the share status
      const updatedReport = await storage.reports.shareReport(
        reportId,
        isShared,
        user.id
      );

      return NextResponse.json({ report: updatedReport });
    } catch (error) {
      console.error("Error updating report share status:", error);
      return NextResponse.json(
        { error: "Failed to update report share status" },
        { status: 500 }
      );
    }
  }
);

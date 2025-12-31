import { type NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-auth";
import { getServerStorageService } from "@/lib/services/storage";

export const DELETE = withAuth(
  async (request: NextRequest, { params }) => {
    try {
      const resolvedParams = await params;
      const connectionId = resolvedParams?.id as string;

      if (!connectionId) {
        return NextResponse.json(
          { error: "Connection ID is required" },
          { status: 400 }
        );
      }

      const storage = getServerStorageService();

      // Get the connection to make sure it exists
      const connection = await storage.connections.getConnection(connectionId);
      if (!connection) {
        return NextResponse.json(
          { error: "Connection not found" },
          { status: 404 }
        );
      }

      // Delete associated schema if exists
      try {
        await storage.schemas.deleteSchema(connectionId);
      } catch {
        // Ignore errors if schema doesn't exist
      }

      // Delete the connection
      await storage.connections.deleteConnection(connectionId);

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Error deleting connection:", error);
      return NextResponse.json(
        { error: "Failed to delete connection" },
        { status: 500 }
      );
    }
  },
  { requireAdmin: true }
);

export const PATCH = withAuth(
  async (request: NextRequest, { params }) => {
    try {
      const resolvedParams = await params;
      const connectionId = resolvedParams?.id as string;

      if (!connectionId) {
        return NextResponse.json(
          { error: "Connection ID is required" },
          { status: 400 }
        );
      }

      const body = await request.json();
      const storage = getServerStorageService();

      // Get the connection to make sure it exists
      const connection = await storage.connections.getConnection(connectionId);
      if (!connection) {
        return NextResponse.json(
          { error: "Connection not found" },
          { status: 404 }
        );
      }

      // Update the connection
      const updatedConnection = await storage.connections.updateConnection(
        connectionId,
        body
      );

      // Don't return password
      const sanitizedConnection = {
        ...updatedConnection,
        password: undefined,
      };

      return NextResponse.json({ connection: sanitizedConnection });
    } catch (error) {
      console.error("Error updating connection:", error);
      return NextResponse.json(
        { error: "Failed to update connection" },
        { status: 500 }
      );
    }
  },
  { requireAdmin: true }
);

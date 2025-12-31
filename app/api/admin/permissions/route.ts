import { type NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-auth";
import { getServerStorageService } from "@/lib/services/storage";

export const GET = withAuth(
  async (request, { user }) => {
    try {
      const storage = getServerStorageService();

      // Get all users and connections
      const users = await storage.users.getAllUsers();
      const connections = await storage.connections.getConnections();

      // Build permissions matrix
      const permissions: Record<string, string[]> = {};

      for (const u of users) {
        // Skip admins as they have access to everything
        if (u.role === "admin") continue;

        permissions[u.id] = [];

        for (const conn of connections) {
          const hasAccess = await storage.permissions.hasConnectionAccess(
            conn.id,
            u.id
          );
          if (hasAccess) {
            permissions[u.id].push(conn.id);
          }
        }
      }

      // Sanitize connections (don't return passwords)
      const sanitizedConnections = connections.map((conn) => ({
        ...conn,
        password: undefined,
      }));

      return NextResponse.json({
        users,
        connections: sanitizedConnections,
        permissions,
      });
    } catch (error) {
      console.error("Error fetching permissions:", error);
      return NextResponse.json(
        { error: "Failed to fetch permissions" },
        { status: 500 }
      );
    }
  },
  { requireAdmin: true }
);

export const POST = withAuth(
  async (request: NextRequest, { user }) => {
    try {
      const body = await request.json();
      const { userId, connectionId } = body;

      if (!userId || !connectionId) {
        return NextResponse.json(
          { error: "userId and connectionId are required" },
          { status: 400 }
        );
      }

      const storage = getServerStorageService();

      // Verify user exists
      const targetUser = await storage.users.getUser(userId);
      if (!targetUser) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        );
      }

      // Verify connection exists
      const connection = await storage.connections.getConnection(connectionId);
      if (!connection) {
        return NextResponse.json(
          { error: "Connection not found" },
          { status: 404 }
        );
      }

      // Grant permission
      await storage.permissions.grantConnectionAccess(
        connectionId,
        userId,
        user.id
      );

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Error granting permission:", error);
      return NextResponse.json(
        { error: "Failed to grant permission" },
        { status: 500 }
      );
    }
  },
  { requireAdmin: true }
);

export const DELETE = withAuth(
  async (request: NextRequest) => {
    try {
      const body = await request.json();
      const { userId, connectionId } = body;

      if (!userId || !connectionId) {
        return NextResponse.json(
          { error: "userId and connectionId are required" },
          { status: 400 }
        );
      }

      const storage = getServerStorageService();

      // Revoke permission
      await storage.permissions.revokeConnectionAccess(connectionId, userId);

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Error revoking permission:", error);
      return NextResponse.json(
        { error: "Failed to revoke permission" },
        { status: 500 }
      );
    }
  },
  { requireAdmin: true }
);

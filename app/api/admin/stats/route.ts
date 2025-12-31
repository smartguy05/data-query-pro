import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-auth";
import { getServerStorageService } from "@/lib/services/storage";

export const GET = withAuth(
  async () => {
    try {
      const storage = getServerStorageService();

      // Get all users
      const users = await storage.users.getAllUsers();
      const userCount = users.length;
      const adminCount = users.filter((u) => u.role === "admin").length;

      // Get all connections
      const connections = await storage.connections.getConnections();
      const connectionCount = connections.length;

      // Get recent logins (users with lastLogin, sorted by recency)
      const recentLogins = users
        .filter((u) => u.lastLogin)
        .sort((a, b) => {
          const dateA = new Date(a.lastLogin || 0).getTime();
          const dateB = new Date(b.lastLogin || 0).getTime();
          return dateB - dateA;
        })
        .slice(0, 5)
        .map((u) => ({
          email: u.email,
          lastLogin: u.lastLogin,
        }));

      return NextResponse.json({
        userCount,
        adminCount,
        connectionCount,
        recentLogins,
      });
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      return NextResponse.json(
        { error: "Failed to fetch admin stats" },
        { status: 500 }
      );
    }
  },
  { requireAdmin: true }
);

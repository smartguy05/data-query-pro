import { type NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-auth";
import { getServerStorageService } from "@/lib/services/storage";

export const PATCH = withAuth(
  async (request: NextRequest, { params }) => {
    try {
      const resolvedParams = await params;
      const userId = resolvedParams?.id as string;

      if (!userId) {
        return NextResponse.json(
          { error: "User ID is required" },
          { status: 400 }
        );
      }

      const body = await request.json();
      const { role } = body;

      if (role && !["admin", "user"].includes(role)) {
        return NextResponse.json(
          { error: "Invalid role. Must be 'admin' or 'user'" },
          { status: 400 }
        );
      }

      const storage = getServerStorageService();

      // Get the user to make sure they exist
      const user = await storage.users.getUser(userId);
      if (!user) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        );
      }

      // Update the user
      const updates: { role?: "admin" | "user" } = {};
      if (role) updates.role = role;

      const updatedUser = await storage.users.updateUser(userId, updates);

      return NextResponse.json({ user: updatedUser });
    } catch (error) {
      console.error("Error updating user:", error);
      return NextResponse.json(
        { error: "Failed to update user" },
        { status: 500 }
      );
    }
  },
  { requireAdmin: true }
);

export const DELETE = withAuth(
  async (request: NextRequest, { params }) => {
    try {
      const resolvedParams = await params;
      const userId = resolvedParams?.id as string;

      if (!userId) {
        return NextResponse.json(
          { error: "User ID is required" },
          { status: 400 }
        );
      }

      const storage = getServerStorageService();

      // Get the user to make sure they exist
      const user = await storage.users.getUser(userId);
      if (!user) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        );
      }

      await storage.users.deleteUser(userId);

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Error deleting user:", error);
      return NextResponse.json(
        { error: "Failed to delete user" },
        { status: 500 }
      );
    }
  },
  { requireAdmin: true }
);

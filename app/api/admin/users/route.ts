import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-auth";
import { getServerStorageService } from "@/lib/services/storage";

export const GET = withAuth(
  async () => {
    try {
      const storage = getServerStorageService();
      const users = await storage.users.getAllUsers();

      return NextResponse.json({ users });
    } catch (error) {
      console.error("Error fetching users:", error);
      return NextResponse.json(
        { error: "Failed to fetch users" },
        { status: 500 }
      );
    }
  },
  { requireAdmin: true }
);

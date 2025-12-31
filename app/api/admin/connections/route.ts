import { type NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-auth";
import { getServerStorageService } from "@/lib/services/storage";

export const GET = withAuth(
  async () => {
    try {
      const storage = getServerStorageService();
      const connections = await storage.connections.getConnections();

      // Don't return passwords
      const sanitizedConnections = connections.map((conn) => ({
        ...conn,
        password: undefined,
      }));

      return NextResponse.json({ connections: sanitizedConnections });
    } catch (error) {
      console.error("Error fetching connections:", error);
      return NextResponse.json(
        { error: "Failed to fetch connections" },
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
      const { name, type, host, port, database, username, password, description } = body;

      // Validate required fields
      if (!name || !host || !port || !database || !username || !password) {
        return NextResponse.json(
          { error: "Missing required fields: name, host, port, database, username, password" },
          { status: 400 }
        );
      }

      const storage = getServerStorageService();

      const connection = await storage.connections.createConnection(
        {
          name,
          type: type || "postgresql",
          host,
          port: typeof port === "string" ? parseInt(port, 10) : port,
          database,
          username,
          password,
          description,
          status: "disconnected",
        },
        user.id
      );

      // Don't return password
      const sanitizedConnection = {
        ...connection,
        password: undefined,
      };

      return NextResponse.json({ connection: sanitizedConnection });
    } catch (error) {
      console.error("Error creating connection:", error);
      return NextResponse.json(
        { error: "Failed to create connection" },
        { status: 500 }
      );
    }
  },
  { requireAdmin: true }
);

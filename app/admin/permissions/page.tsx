"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, Shield, Database } from "lucide-react";
import type { User } from "@/lib/services/storage/storage.interface";
import type { DatabaseConnection } from "@/models/database-connection.interface";

interface PermissionMatrix {
  users: User[];
  connections: DatabaseConnection[];
  permissions: Record<string, string[]>; // userId -> connectionIds[]
}

export default function PermissionsPage() {
  const [data, setData] = useState<PermissionMatrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchPermissions = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/permissions");
      if (!response.ok) {
        throw new Error("Failed to fetch permissions");
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load permissions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, []);

  const hasPermission = (userId: string, connectionId: string): boolean => {
    if (!data) return false;
    return data.permissions[userId]?.includes(connectionId) || false;
  };

  const handleTogglePermission = async (
    userId: string,
    connectionId: string,
    currentValue: boolean
  ) => {
    const key = `${userId}-${connectionId}`;
    setUpdating(key);

    try {
      const response = await fetch("/api/admin/permissions", {
        method: currentValue ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, connectionId }),
      });

      if (!response.ok) {
        throw new Error("Failed to update permission");
      }

      // Update local state
      setData((prev) => {
        if (!prev) return prev;

        const newPermissions = { ...prev.permissions };

        if (currentValue) {
          // Remove permission
          newPermissions[userId] = (newPermissions[userId] || []).filter(
            (id) => id !== connectionId
          );
        } else {
          // Add permission
          newPermissions[userId] = [...(newPermissions[userId] || []), connectionId];
        }

        return { ...prev, permissions: newPermissions };
      });

      toast({
        title: "Success",
        description: currentValue
          ? "Permission revoked"
          : "Permission granted",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update permission",
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive">Failed to load permissions data</p>
      </div>
    );
  }

  const regularUsers = data.users.filter((u) => u.role === "user");
  const adminUsers = data.users.filter((u) => u.role === "admin");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Permission Management</h1>
          <p className="text-muted-foreground">
            Control which users can access each database connection
          </p>
        </div>
        <Button variant="outline" onClick={fetchPermissions} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Info about admins */}
      {adminUsers.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Administrators</CardTitle>
            </div>
            <CardDescription>
              Admins automatically have access to all connections
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {adminUsers.map((user) => (
                <Badge key={user.id} variant="secondary">
                  {user.name || user.email}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Permissions Matrix */}
      <Card>
        <CardHeader>
          <CardTitle>User Permissions</CardTitle>
          <CardDescription>
            Check the box to grant a user access to a connection
          </CardDescription>
        </CardHeader>
        <CardContent>
          {regularUsers.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No regular users found. All current users are administrators.
            </p>
          ) : data.connections.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No connections configured. Add connections first.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">User</th>
                    {data.connections.map((conn) => (
                      <th
                        key={conn.id}
                        className="text-center py-3 px-4 font-medium min-w-[120px]"
                      >
                        <div className="flex flex-col items-center gap-1">
                          <Database className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{conn.name}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {regularUsers.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium">{user.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {user.email}
                          </div>
                        </div>
                      </td>
                      {data.connections.map((conn) => {
                        const key = `${user.id}-${conn.id}`;
                        const checked = hasPermission(user.id, conn.id);
                        const isUpdating = updating === key;

                        return (
                          <td key={conn.id} className="text-center py-3 px-4">
                            {isUpdating ? (
                              <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                            ) : (
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() =>
                                  handleTogglePermission(user.id, conn.id, checked)
                                }
                              />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

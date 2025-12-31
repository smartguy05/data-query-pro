"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Users,
  Database,
  Shield,
  LayoutDashboard,
  ArrowLeft,
  Loader2,
} from "lucide-react";

const adminNavigation = [
  { name: "Overview", href: "/admin", icon: LayoutDashboard },
  { name: "Users", href: "/admin/users", icon: Users },
  { name: "Connections", href: "/admin/connections", icon: Database },
  { name: "Permissions", href: "/admin/permissions", icon: Shield },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // useSession may return undefined during static generation
  const sessionResult = useSession();
  const session = sessionResult?.data;
  const status = sessionResult?.status ?? "loading";
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  const multiUserEnabled = process.env.NEXT_PUBLIC_MULTI_USER_ENABLED === "true";

  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect if not admin or multi-user mode disabled
  useEffect(() => {
    if (!mounted) return;

    if (!multiUserEnabled) {
      router.push("/");
      return;
    }

    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/admin");
      return;
    }

    if (status === "authenticated" && session?.user?.role !== "admin") {
      router.push("/");
      return;
    }
  }, [mounted, multiUserEnabled, status, session, router]);

  // Show loading state
  if (!mounted || status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Don't render if not authorized
  if (!multiUserEnabled || status !== "authenticated" || session?.user?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 border-r border-border bg-card min-h-[calc(100vh-4rem)]">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-6">
              <Shield className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-lg">Admin Panel</h2>
            </div>

            <nav className="space-y-1">
              {adminNavigation.map((item) => {
                const isActive = pathname === item.href;
                const IconComponent = item.icon;

                return (
                  <Link key={item.name} href={item.href}>
                    <Button
                      variant={isActive ? "secondary" : "ghost"}
                      className={cn(
                        "w-full justify-start gap-2",
                        isActive && "bg-secondary"
                      )}
                    >
                      <IconComponent className="h-4 w-4" />
                      {item.name}
                    </Button>
                  </Link>
                );
              })}
            </nav>

            <div className="mt-8 pt-4 border-t border-border">
              <Link href="/">
                <Button variant="ghost" className="w-full justify-start gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to App
                </Button>
              </Link>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

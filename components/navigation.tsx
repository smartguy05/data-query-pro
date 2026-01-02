"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { BarChart3, Database, FileText, Search, Menu, X, Shield, User, LogOut } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

const navigation = [
  { name: "Dashboard", href: "/", icon: BarChart3 },
  { name: "Database", href: "/database", icon: Database },
  { name: "Schema", href: "/schema", icon: Search },
  { name: "Query", href: "/query", icon: Search },
  { name: "Reports", href: "/reports", icon: FileText },
]

export function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()

  // useSession may return undefined during static generation
  const sessionResult = useSession()
  const session = sessionResult?.data
  const sessionStatus = sessionResult?.status

  const multiUserEnabled = process.env.NEXT_PUBLIC_MULTI_USER_ENABLED === "true"
  const isAdmin = session?.user?.role === "admin"
  const showAdminLink = multiUserEnabled && isAdmin
  const showUserMenu = multiUserEnabled && sessionStatus === "authenticated" && session

  return (
    <nav className="bg-background border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg shadow-lg shadow-blue-500/20">
              <Database className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gradient">DataQuery Pro</h1>
              <p className="text-xs text-muted-foreground">Executive Analytics Platform</p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navigation.map((item) => {
              const IconComponent = item.icon
              const isActive = pathname === item.href
              return (
                <Link key={item.name} href={item.href}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    className={cn(
                      "flex items-center gap-2",
                      isActive ? "bg-blue-600 text-white dark:bg-blue-700" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <IconComponent className="h-4 w-4" />
                    {item.name}
                  </Button>
                </Link>
              )
            })}
            {showAdminLink && (
              <Link href="/admin">
                <Button
                  variant={pathname.startsWith("/admin") ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "flex items-center gap-2",
                    pathname.startsWith("/admin")
                      ? "bg-blue-600 text-white dark:bg-blue-700"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Shield className="h-4 w-4" />
                  Admin
                </Button>
              </Link>
            )}
            <div className="ml-4 pl-4 border-l border-slate-200 dark:border-slate-700 flex items-center gap-2">
              <ThemeToggle />
              {multiUserEnabled && session && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2">
                      <User className="h-4 w-4" />
                      <span className="max-w-[100px] truncate">
                        {session.user?.name || session.user?.email}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                      {session.user?.email}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border py-4">
            <div className="space-y-1">
              {navigation.map((item) => {
                const IconComponent = item.icon
                const isActive = pathname === item.href
                return (
                  <Link key={item.name} href={item.href}>
                    <Button
                      variant={isActive ? "default" : "ghost"}
                      size="sm"
                      className={cn(
                        "w-full justify-start gap-2",
                        isActive ? "bg-blue-600 text-white dark:bg-blue-700" : "text-muted-foreground",
                      )}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <IconComponent className="h-4 w-4" />
                      {item.name}
                    </Button>
                  </Link>
                )
              })}
              {showAdminLink && (
                <Link href="/admin">
                  <Button
                    variant={pathname.startsWith("/admin") ? "default" : "ghost"}
                    size="sm"
                    className={cn(
                      "w-full justify-start gap-2",
                      pathname.startsWith("/admin")
                        ? "bg-blue-600 text-white dark:bg-blue-700"
                        : "text-muted-foreground",
                    )}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Shield className="h-4 w-4" />
                    Admin
                  </Button>
                </Link>
              )}
              {multiUserEnabled && session && (
                <div className="pt-2 mt-2 border-t border-border">
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    {session.user?.email}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2 text-muted-foreground"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

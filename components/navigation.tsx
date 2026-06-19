"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { BarChart3, Database, FileText, Search, Menu, X, LogOut, Shield, User, History, GraduationCap, ChevronDown } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { ApiKeyIndicator } from "@/components/api-key-indicator"
import { useAuth } from "@/hooks/use-auth"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const standaloneLinks = [
  { name: "Dashboard", href: "/", icon: BarChart3 },
]

const navGroups = [
  {
    name: "Data",
    icon: Database,
    items: [
      { name: "Database", href: "/database", icon: Database },
      { name: "Schema", href: "/schema", icon: Search },
    ],
  },
  {
    name: "Query",
    icon: Search,
    items: [
      { name: "Query", href: "/query", icon: Search },
      { name: "History", href: "/history", icon: History },
      { name: "Learning", href: "/learning", icon: GraduationCap },
      { name: "Reports", href: "/reports", icon: FileText },
    ],
  },
]

type NavGroup = (typeof navGroups)[number]

export function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()
  const { user, isAdmin, isAuthenticated, authEnabled, signOut } = useAuth()

  const isGroupActive = (group: NavGroup) => group.items.some((item) => pathname === item.href)

  // Don't render navigation on landing page or login page
  if (pathname === "/landing" || pathname === "/auth/login") {
    return null
  }

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
            {standaloneLinks.map((item) => {
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
            {navGroups.map((group) => {
              const GroupIcon = group.icon
              const groupActive = isGroupActive(group)
              return (
                <DropdownMenu key={group.name}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant={groupActive ? "default" : "ghost"}
                      size="sm"
                      className={cn(
                        "flex items-center gap-2",
                        groupActive ? "bg-blue-600 text-white dark:bg-blue-700" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <GroupIcon className="h-4 w-4" />
                      {group.name}
                      <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    {group.items.map((item) => {
                      const ItemIcon = item.icon
                      const isActive = pathname === item.href
                      return (
                        <DropdownMenuItem key={item.name} asChild>
                          <Link
                            href={item.href}
                            className={cn(
                              "flex items-center gap-2 cursor-pointer",
                              isActive && "text-blue-600 dark:text-blue-400 font-medium",
                            )}
                          >
                            <ItemIcon className="h-4 w-4" />
                            {item.name}
                          </Link>
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )
            })}
            <div className="ml-4 pl-4 border-l border-slate-200 dark:border-slate-700 flex items-center gap-2">
              <ApiKeyIndicator />
              <ThemeToggle />
              {authEnabled && isAuthenticated && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-medium">
                        {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
                      </div>
                      <span className="text-sm text-muted-foreground max-w-[120px] truncate">
                        {user?.name || user?.email}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="px-2 py-1.5">
                      <p className="text-sm font-medium">{user?.name}</p>
                      <p className="text-xs text-muted-foreground">{user?.email}</p>
                      {isAdmin && (
                        <span className="inline-flex items-center mt-1 px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/10 text-amber-500 rounded">
                          Admin
                        </span>
                      )}
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link
                        href="/profile"
                        className={cn(
                          "flex items-center gap-2",
                          pathname === "/profile" && "text-blue-600 dark:text-blue-400 font-medium",
                        )}
                      >
                        <User className="h-4 w-4" />
                        Profile
                      </Link>
                    </DropdownMenuItem>
                    {isAdmin && (
                      <DropdownMenuItem asChild>
                        <Link
                          href="/admin"
                          className={cn(
                            "flex items-center gap-2",
                            pathname === "/admin" && "text-blue-600 dark:text-blue-400 font-medium",
                          )}
                        >
                          <Shield className="h-4 w-4" />
                          Admin
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => signOut()} className="text-red-500 focus:text-red-500">
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center gap-2">
            <ApiKeyIndicator />
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
              {standaloneLinks.map((item) => {
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
              {navGroups.map((group) => (
                <div key={group.name} className="pt-2">
                  <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {group.name}
                  </p>
                  {group.items.map((item) => {
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
                </div>
              ))}
              {authEnabled && isAuthenticated && (
                <>
                  <div className="border-t border-border my-2 pt-2">
                    <div className="px-3 py-1">
                      <p className="text-sm font-medium">{user?.name || user?.email}</p>
                      <p className="text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                    <Link href="/profile">
                      <Button
                        variant={pathname === "/profile" ? "default" : "ghost"}
                        size="sm"
                        className={cn(
                          "w-full justify-start gap-2",
                          pathname === "/profile" ? "bg-blue-600 text-white dark:bg-blue-700" : "text-muted-foreground",
                        )}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <User className="h-4 w-4" />
                        Profile
                      </Button>
                    </Link>
                    {isAdmin && (
                      <Link href="/admin">
                        <Button
                          variant={pathname === "/admin" ? "default" : "ghost"}
                          size="sm"
                          className={cn(
                            "w-full justify-start gap-2",
                            pathname === "/admin" ? "bg-blue-600 text-white dark:bg-blue-700" : "text-muted-foreground",
                          )}
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <Shield className="h-4 w-4" />
                          Admin
                        </Button>
                      </Link>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start gap-2 text-red-500"
                      onClick={() => { setMobileMenuOpen(false); signOut() }}
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

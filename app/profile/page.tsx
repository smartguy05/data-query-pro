"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { useDatabaseOptions } from "@/lib/database-connection-options"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import {
  User,
  Shield,
  Mail,
  Users,
  Database,
  FileText,
  Target,
  LogOut,
  Laptop,
} from "lucide-react"

export default function ProfilePage() {
  const { user, isAdmin, groups, isAuthenticated, authEnabled, isLoading, signOut } = useAuth()
  const { connections, reports, queryAccuracy } = useDatabaseOptions()
  const router = useRouter()

  // In auth mode, a profile requires a signed-in user. Bounce out if not authenticated.
  useEffect(() => {
    if (!isLoading && authEnabled && !isAuthenticated) {
      router.replace("/")
    }
  }, [isLoading, authEnabled, isAuthenticated, router])

  if (isLoading || (authEnabled && !isAuthenticated)) {
    return null
  }

  const displayName = user?.name || user?.email || "Local User"
  const initial = displayName[0]?.toUpperCase() || "U"
  const accuracyPct =
    queryAccuracy.total > 0
      ? Math.round((queryAccuracy.successful / queryAccuracy.total) * 100)
      : null

  const stats = [
    {
      label: "Query Accuracy",
      value: accuracyPct !== null ? `${accuracyPct}%` : "—",
      sub: `${queryAccuracy.successful}/${queryAccuracy.total} queries`,
      icon: Target,
    },
    {
      label: "Connections",
      value: String(connections.length),
      sub: connections.length === 1 ? "database" : "databases",
      icon: Database,
    },
    {
      label: "Saved Reports",
      value: String(reports.length),
      sub: reports.length === 1 ? "report" : "reports",
      icon: FileText,
    },
  ]

  return (
    <div className="max-w-4xl mx-auto py-8 px-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
          <User className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Profile</h1>
          <p className="text-sm text-muted-foreground">Your account and usage at a glance</p>
        </div>
      </div>

      {/* Account card */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          {authEnabled && user ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <Avatar className="h-16 w-16">
                {user.image && <AvatarImage src={user.image} alt={displayName} />}
                <AvatarFallback className="bg-blue-600 text-white text-xl font-medium">
                  {initial}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">{displayName}</h2>
                  {isAdmin && (
                    <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      <Shield className="h-3 w-3 mr-1" />
                      Admin
                    </Badge>
                  )}
                </div>
                {user.email && (
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    {user.email}
                  </p>
                )}
                {groups.length > 0 && (
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    {groups.join(", ")}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="p-3 bg-muted rounded-full">
                <Laptop className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Local mode</h2>
                <p className="text-sm text-muted-foreground">
                  Sign-in is disabled. Your connections, reports, and history are stored on this device.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {stats.map((stat) => {
              const StatIcon = stat.icon
              return (
                <div key={stat.label} className="rounded-lg border border-border p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <StatIcon className="h-4 w-4" />
                    <span className="text-xs font-medium uppercase tracking-wider">{stat.label}</span>
                  </div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{stat.sub}</p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      {authEnabled && isAuthenticated && (
        <>
          <Separator className="my-6" />
          <div className="flex flex-wrap gap-3">
            {isAdmin && (
              <Link href="/admin">
                <Button variant="outline" className="gap-2">
                  <Shield className="h-4 w-4" />
                  Admin Panel
                </Button>
              </Link>
            )}
            <Button
              variant="outline"
              className="gap-2 text-red-500 hover:text-red-600"
              onClick={() => signOut()}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

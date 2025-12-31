import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { Navigation } from "@/components/navigation"
import {DatabaseConnectionOptions} from "@/lib/database-connection-options";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { SessionProvider } from "@/components/auth/session-provider";

export const metadata: Metadata = {
  title: "Database Query & Reporting Platform",
  description: "Professional database query and reporting application for executives and analysts",
    generator: 'v0.app'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Check if multi-user mode is enabled (server-side)
  const multiUserEnabled = process.env.MULTI_USER_ENABLED === "true";

  return (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <body className="font-sans">
        <SessionProvider multiUserEnabled={multiUserEnabled}>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem={false}
            disableTransitionOnChange
          >
            <DatabaseConnectionOptions>
              <Navigation />
              <main>{children}</main>
              <Toaster />
            </DatabaseConnectionOptions>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  )
}

import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { Navigation } from "@/components/navigation"
import {DatabaseConnectionOptions} from "@/lib/database-connection-options";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { OpenAIApiProvider } from "@/components/openai-api-provider";

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
  return (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <body className="font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <OpenAIApiProvider>
            <DatabaseConnectionOptions>
              <Navigation />
              <main>{children}</main>
              <Toaster />
            </DatabaseConnectionOptions>
          </OpenAIApiProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

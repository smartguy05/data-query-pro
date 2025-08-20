import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { Navigation } from "@/components/navigation"

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
    <html lang="en" className="antialiased">
      <body className="font-sans">
        <Navigation />
        <main>{children}</main>
      </body>
    </html>
  )
}

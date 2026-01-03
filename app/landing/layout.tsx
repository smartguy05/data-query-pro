import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "DataQuery Pro - AI-Powered Database Queries in Natural Language",
  description: "Free, open-source AI tool that converts natural language to SQL. Query PostgreSQL, MySQL, SQL Server, and SQLite databases using plain English. Self-hosted and privacy-first.",
  keywords: [
    "database query",
    "natural language to SQL",
    "AI database tool",
    "SQL generator",
    "database visualization",
    "PostgreSQL",
    "MySQL",
    "SQL Server",
    "SQLite",
    "open source",
    "self-hosted",
  ],
  authors: [{ name: "DataQuery Pro" }],
  creator: "DataQuery Pro",
  publisher: "DataQuery Pro",
  metadataBase: new URL("https://dataquerypro.com"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://dataquerypro.com",
    title: "DataQuery Pro - AI-Powered Database Queries in Natural Language",
    description: "Ask questions in plain English, get real answers from your database. Free, open-source, and self-hosted.",
    siteName: "DataQuery Pro",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "DataQuery Pro - Natural Language Database Queries",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DataQuery Pro - AI-Powered Database Queries",
    description: "Query databases with natural language. Free, open-source, and self-hosted.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
}

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}

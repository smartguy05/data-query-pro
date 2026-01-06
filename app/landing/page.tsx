"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ThemeToggle } from "@/components/theme-toggle"
import Link from "next/link"
import Image from "next/image"
import {
  Database,
  Sparkles,
  MessageSquare,
  BarChart3,
  GitBranch,
  FileText,
  Check,
  Github,
  ArrowRight,
  Zap,
  Shield,
  Layers,
  RefreshCw,
  Server,
  Eye,
} from "lucide-react"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg shadow-lg shadow-blue-500/20">
                <Database className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gradient">DataQuery Pro</h1>
                <p className="text-xs text-muted-foreground">AI-Powered Database Queries</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <Link href="https://github.com/smartguy05/data-query-pro" target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm" className="gap-2">
                  <Github className="h-4 w-4" />
                  <span className="hidden sm:inline">GitHub</span>
                </Button>
              </Link>
              <Link href="/">
                <Button size="sm">
                  Open App
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-20 md:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 via-purple-500/5 to-background" />
        <div className="max-w-7xl mx-auto px-6 relative">
          <div className="text-center max-w-4xl mx-auto space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
              <Sparkles className="h-4 w-4" />
              Free & Open Source
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight">
              Ask questions in{" "}
              <span className="text-gradient">plain English</span>,<br />
              get real answers from your database
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
              DataQuery Pro converts natural language to SQL using AI, with self-correcting queries
              and multi-database support. No SQL knowledge required.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link href="/">
                <Button size="lg" className="gap-2 text-base px-8">
                  <Zap className="h-5 w-5" />
                  Try Demo
                </Button>
              </Link>
              <Link href="https://github.com/smartguy05/data-query-pro" target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline" className="gap-2 text-base px-8">
                  <Github className="h-5 w-5" />
                  View on GitHub
                </Button>
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">
              Self-hosted • Privacy-first • MIT License
            </p>
          </div>
        </div>
      </section>

      {/* Feature Highlights */}
      <section className="py-20 border-t border-border bg-muted/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Powerful features for everyone
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From data analysts to business users, DataQuery Pro makes database queries accessible to everyone
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardContent className="pt-6">
                <div className="p-3 bg-primary/10 rounded-lg w-fit mb-4">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Natural Language Queries</h3>
                <p className="text-muted-foreground">
                  Ask questions in plain English and get SQL generated automatically. No need to remember complex syntax.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardContent className="pt-6">
                <div className="p-3 bg-primary/10 rounded-lg w-fit mb-4">
                  <RefreshCw className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Self-Correcting Queries</h3>
                <p className="text-muted-foreground">
                  When queries fail, AI automatically analyzes errors and generates corrected SQL. No manual debugging.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardContent className="pt-6">
                <div className="p-3 bg-primary/10 rounded-lg w-fit mb-4">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Query Enhancement</h3>
                <p className="text-muted-foreground">
                  AI expands vague questions with schema-specific details, ensuring accurate and comprehensive results.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardContent className="pt-6">
                <div className="p-3 bg-primary/10 rounded-lg w-fit mb-4">
                  <Server className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Multi-Database Support</h3>
                <p className="text-muted-foreground">
                  Works with PostgreSQL, MySQL, SQL Server, and SQLite. Switch between databases seamlessly.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardContent className="pt-6">
                <div className="p-3 bg-primary/10 rounded-lg w-fit mb-4">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Beautiful Visualizations</h3>
                <p className="text-muted-foreground">
                  View results as tables or charts. Bar, line, pie, area, and scatter charts supported out of the box.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardContent className="pt-6">
                <div className="p-3 bg-primary/10 rounded-lg w-fit mb-4">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Saved Reports</h3>
                <p className="text-muted-foreground">
                  Save queries as reusable reports with parameters. Share insights across your team effortlessly.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardContent className="pt-6">
                <div className="p-3 bg-primary/10 rounded-lg w-fit mb-4">
                  <GitBranch className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Follow-up Questions</h3>
                <p className="text-muted-foreground">
                  Drill deeper into results with contextual follow-up questions. Explore your data conversationally.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardContent className="pt-6">
                <div className="p-3 bg-primary/10 rounded-lg w-fit mb-4">
                  <Eye className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">AI Schema Descriptions</h3>
                <p className="text-muted-foreground">
                  Auto-generate human-readable descriptions for tables and columns to improve query accuracy.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardContent className="pt-6">
                <div className="p-3 bg-primary/10 rounded-lg w-fit mb-4">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Self-Hosted & Private</h3>
                <p className="text-muted-foreground">
                  Keep your data secure. Run entirely on your infrastructure with full control over your information.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Screenshots Section */}
      <section className="py-20 border-t border-border">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              See DataQuery Pro in action
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From natural language queries to beautiful visualizations
            </p>
          </div>
          <div className="space-y-12">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                  <MessageSquare className="h-4 w-4" />
                  Natural Language
                </div>
                <h3 className="text-2xl md:text-3xl font-bold">
                  Ask questions naturally
                </h3>
                <p className="text-lg text-muted-foreground">
                  Type your question in plain English. AI understands your intent and generates the perfect SQL query.
                </p>
              </div>
              <Card className="overflow-hidden border-2">
                <Image
                  src="/screenshots/08-query-entered.png"
                  alt="Natural language query input"
                  width={800}
                  height={600}
                  className="w-full h-auto"
                />
              </Card>
            </div>

            <div className="grid md:grid-cols-2 gap-8 items-center">
              <Card className="overflow-hidden border-2 md:order-1">
                <Image
                  src="/screenshots/09-query-generated.png"
                  alt="Generated SQL query"
                  width={800}
                  height={600}
                  className="w-full h-auto"
                />
              </Card>
              <div className="space-y-4 md:order-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                  <Sparkles className="h-4 w-4" />
                  AI-Generated SQL
                </div>
                <h3 className="text-2xl md:text-3xl font-bold">
                  Review the generated query
                </h3>
                <p className="text-lg text-muted-foreground">
                  See the SQL that AI generated, with explanations and confidence scores. You can also edit the query directly before executing it. Learn as you query.
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                  <BarChart3 className="h-4 w-4" />
                  Visualizations
                </div>
                <h3 className="text-2xl md:text-3xl font-bold">
                  Beautiful charts and tables
                </h3>
                <p className="text-lg text-muted-foreground">
                  View results as interactive tables or switch to chart view. Let AI automatically choose the best chart type for your data, or select from bar, line, pie, area, and scatter charts.
                </p>
              </div>
              <Card className="overflow-hidden border-2">
                <Image
                  src="/screenshots/11-query-results-chart.png"
                  alt="Query results with charts"
                  width={800}
                  height={600}
                  className="w-full h-auto"
                />
              </Card>
            </div>

            <div className="grid md:grid-cols-2 gap-8 items-center">
              <Card className="overflow-hidden border-2 md:order-1">
                <Image
                  src="/screenshots/21-query-error-revise.png"
                  alt="Self-correcting query errors"
                  width={800}
                  height={600}
                  className="w-full h-auto"
                />
              </Card>
              <div className="space-y-4 md:order-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                  <RefreshCw className="h-4 w-4" />
                  Self-Correcting
                </div>
                <h3 className="text-2xl md:text-3xl font-bold">
                  Automatic error correction
                </h3>
                <p className="text-lg text-muted-foreground">
                  When queries fail, AI analyzes the error and automatically generates a corrected version.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 border-t border-border bg-muted/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              How it works
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Get started in minutes with our simple workflow
            </p>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="relative">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-4 bg-primary rounded-full text-primary-foreground text-2xl font-bold w-16 h-16 flex items-center justify-center">
                  1
                </div>
                <h3 className="text-xl font-semibold">Connect Database</h3>
                <p className="text-muted-foreground">
                  Add your PostgreSQL, MySQL, SQL Server, or SQLite database connection
                </p>
              </div>
              <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-0.5 bg-border">
                <ArrowRight className="absolute -top-3 -right-3 h-6 w-6 text-muted-foreground" />
              </div>
            </div>

            <div className="relative">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-4 bg-primary rounded-full text-primary-foreground text-2xl font-bold w-16 h-16 flex items-center justify-center">
                  2
                </div>
                <h3 className="text-xl font-semibold">Upload Schema</h3>
                <p className="text-muted-foreground">
                  AI analyzes your database structure and generates helpful descriptions
                </p>
              </div>
              <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-0.5 bg-border">
                <ArrowRight className="absolute -top-3 -right-3 h-6 w-6 text-muted-foreground" />
              </div>
            </div>

            <div className="relative">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-4 bg-primary rounded-full text-primary-foreground text-2xl font-bold w-16 h-16 flex items-center justify-center">
                  3
                </div>
                <h3 className="text-xl font-semibold">Ask Questions</h3>
                <p className="text-muted-foreground">
                  Type your questions naturally - AI converts them to accurate SQL queries
                </p>
              </div>
              <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-0.5 bg-border">
                <ArrowRight className="absolute -top-3 -right-3 h-6 w-6 text-muted-foreground" />
              </div>
            </div>

            <div className="relative">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-4 bg-primary rounded-full text-primary-foreground text-2xl font-bold w-16 h-16 flex items-center justify-center">
                  4
                </div>
                <h3 className="text-xl font-semibold">Get Insights</h3>
                <p className="text-muted-foreground">
                  View results as tables or charts, save queries, and ask follow-up questions
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Database Support */}
      <section className="py-20 border-t border-border">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Works with your database
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Support for the most popular database systems
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardContent className="pt-8 pb-8 text-center">
                <div className="p-4 bg-primary/10 rounded-lg w-fit mx-auto mb-4">
                  <Server className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">PostgreSQL</h3>
              </CardContent>
            </Card>
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardContent className="pt-8 pb-8 text-center">
                <div className="p-4 bg-primary/10 rounded-lg w-fit mx-auto mb-4">
                  <Server className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">MySQL</h3>
              </CardContent>
            </Card>
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardContent className="pt-8 pb-8 text-center">
                <div className="p-4 bg-primary/10 rounded-lg w-fit mx-auto mb-4">
                  <Server className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">SQL Server</h3>
              </CardContent>
            </Card>
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardContent className="pt-8 pb-8 text-center">
                <div className="p-4 bg-primary/10 rounded-lg w-fit mx-auto mb-4">
                  <Server className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">SQLite</h3>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Get Started */}
      <section className="py-20 border-t border-border bg-muted/30">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Get started in minutes
            </h2>
            <p className="text-lg text-muted-foreground">
              Self-host DataQuery Pro with Docker or npm
            </p>
          </div>
          <Card className="border-2">
            <CardContent className="pt-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Layers className="h-5 w-5 text-primary" />
                  Docker (Recommended)
                </h3>
                <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm space-y-2">
                  <div># Clone the repository</div>
                  <div className="text-primary">git clone https://github.com/smartguy05/data-query-pro.git</div>
                  <div className="text-primary">cd data-query-pro</div>
                  <div className="mt-4"># Set your API key and run with docker-compose</div>
                  <div className="text-primary">OPENAI_API_KEY=your_key docker-compose up -d</div>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Server className="h-5 w-5 text-primary" />
                  NPM
                </h3>
                <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm space-y-2">
                  <div># Clone and install</div>
                  <div className="text-primary">git clone https://github.com/smartguy05/data-query-pro.git</div>
                  <div className="text-primary">cd data-query-pro</div>
                  <div className="text-primary">npm install</div>
                  <div className="mt-4"># Set up environment</div>
                  <div className="text-primary">echo "OPENAI_API_KEY=your_key" &gt; .env.local</div>
                  <div className="mt-4"># Run</div>
                  <div className="text-primary">npm run dev</div>
                </div>
              </div>
              <div className="pt-4 border-t border-border">
                <h3 className="text-lg font-semibold mb-3">Requirements</h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>OpenAI API key for AI features</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>Node.js 18+ or Docker</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>Database connection (PostgreSQL, MySQL, SQL Server, or SQLite)</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 border-t border-border">
        <div className="max-w-4xl mx-auto px-6 text-center space-y-8">
          <h2 className="text-3xl md:text-5xl font-bold">
            Ready to query your data with{" "}
            <span className="text-gradient">natural language</span>?
          </h2>
          <p className="text-xl text-muted-foreground">
            Join the community of data professionals using DataQuery Pro
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/">
              <Button size="lg" className="gap-2 text-base px-8">
                <Zap className="h-5 w-5" />
                Try Demo Now
              </Button>
            </Link>
            <Link href="https://github.com/smartguy05/data-query-pro" target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="outline" className="gap-2 text-base px-8">
                <Github className="h-5 w-5" />
                Star on GitHub
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg shadow-lg shadow-blue-500/20">
                  <Database className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gradient">DataQuery Pro</h3>
                  <p className="text-xs text-muted-foreground">AI-Powered Database Queries</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Free, open-source tool for querying databases with natural language using AI.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="https://github.com/smartguy05/data-query-pro" className="hover:text-primary transition-colors" target="_blank" rel="noopener noreferrer">
                    GitHub Repository
                  </Link>
                </li>
                <li>
                  <Link href="https://github.com/smartguy05/data-query-pro#readme" className="hover:text-primary transition-colors" target="_blank" rel="noopener noreferrer">
                    Documentation
                  </Link>
                </li>
                <li>
                  <Link href="https://github.com/smartguy05/data-query-pro/issues" className="hover:text-primary transition-colors" target="_blank" rel="noopener noreferrer">
                    Report Issues
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Community</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="https://github.com/smartguy05/data-query-pro/discussions" className="hover:text-primary transition-colors" target="_blank" rel="noopener noreferrer">
                    Discussions
                  </Link>
                </li>
                <li>
                  <Link href="https://github.com/smartguy05/data-query-pro/blob/main/CONTRIBUTING.md" className="hover:text-primary transition-colors" target="_blank" rel="noopener noreferrer">
                    Contributing
                  </Link>
                </li>
                <li>
                  <Link href="/" className="hover:text-primary transition-colors">
                    Try Demo
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>
              © {new Date().getFullYear()} DataQuery Pro. Released under the MIT License.
            </p>
            <div className="flex items-center gap-4">
              <Link href="https://github.com/smartguy05/data-query-pro/blob/main/LICENSE" className="hover:text-primary transition-colors" target="_blank" rel="noopener noreferrer">
                MIT License
              </Link>
              <Link href="https://github.com/smartguy05" className="hover:text-primary transition-colors" target="_blank" rel="noopener noreferrer">
                GitHub
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

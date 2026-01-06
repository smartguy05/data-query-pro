"use client"

import React, { Component, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, RefreshCw } from "lucide-react"

interface ErrorBoundaryProps {
  /** Content to render when no error */
  children: ReactNode
  /** Optional fallback component to render on error */
  fallback?: ReactNode
  /** Callback when error occurs */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  /** Whether to show the reset button. Default: true */
  showReset?: boolean
  /** Title to show in error card. Default: "Something went wrong" */
  title?: string
  /** Description to show in error card */
  description?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * React Error Boundary component that catches JavaScript errors in child components.
 *
 * This prevents the entire app from crashing when a component throws an error.
 * Instead, it displays a fallback UI with an option to retry.
 *
 * @example
 * <ErrorBoundary>
 *   <MyComponent />
 * </ErrorBoundary>
 *
 * @example
 * <ErrorBoundary
 *   title="Failed to load dashboard"
 *   onError={(error) => logError(error)}
 *   fallback={<CustomErrorPage />}
 * >
 *   <Dashboard />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error to console for debugging
    console.error("[ErrorBoundary] Caught error:", error)
    console.error("[ErrorBoundary] Error info:", errorInfo)

    // Call onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // If custom fallback provided, use it
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      const {
        showReset = true,
        title = "Something went wrong",
        description = "An unexpected error occurred. Please try again.",
      } = this.props

      return (
        <div className="flex items-center justify-center min-h-[400px] p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-5 w-5" />
                {title}
              </CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {this.state.error && (
                <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md">
                  <p className="text-sm text-red-700 dark:text-red-300 font-mono break-all">
                    {this.state.error.message}
                  </p>
                </div>
              )}
              {showReset && (
                <Button onClick={this.handleReset} variant="outline" className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Higher-order component that wraps a component with an ErrorBoundary.
 *
 * @param WrappedComponent - Component to wrap
 * @param errorBoundaryProps - Props to pass to ErrorBoundary
 * @returns Wrapped component with error boundary
 *
 * @example
 * const SafeDashboard = withErrorBoundary(Dashboard, {
 *   title: "Dashboard Error",
 *   onError: logError
 * });
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, "children">
): React.FC<P> {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || "Component"

  const WithErrorBoundary: React.FC<P> = (props) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  )

  WithErrorBoundary.displayName = `withErrorBoundary(${displayName})`

  return WithErrorBoundary
}

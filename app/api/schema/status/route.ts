import { type NextRequest, NextResponse } from "next/server"
import { getAuthContext } from '@/lib/auth/require-auth'

// Access the same in-memory storage
declare global {
  var processStatus: Map<
    string,
    {
      status: "pending" | "processing" | "completed" | "error"
      progress: number
      message: string
      result?: any
      error?: string
      startTime: number
    }
  >
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    const { searchParams } = new URL(request.url)
    const processId = searchParams.get("processId")

    if (!processId) {
      return NextResponse.json({ error: "Process ID is required" }, { status: 400 })
    }

    // Get status from the same map used in start-introspection
    const status = global.processStatus?.get(processId)

    if (!status) {
      return NextResponse.json({ error: "Process not found" }, { status: 404 })
    }

    // Clean up completed/error processes after 5 minutes
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    if ((status.status === "completed" || status.status === "error") && status.startTime < fiveMinutesAgo) {
      global.processStatus?.delete(processId)
    }

    return NextResponse.json(status)
  } catch (error) {
    console.error("Error checking process status:", error)
    return NextResponse.json({ error: "Failed to check process status" }, { status: 500 })
  }
}

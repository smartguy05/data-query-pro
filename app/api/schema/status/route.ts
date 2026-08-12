import { type NextRequest, NextResponse } from "next/server"
import { getAuthContext } from '@/lib/auth/require-auth'
// Job state is owned by this shared module, not a duplicated `declare global`.
import { deleteJob, getJob } from "@/lib/schema/introspection-jobs"

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    const { searchParams } = new URL(request.url)
    const processId = searchParams.get("processId")

    if (!processId) {
      return NextResponse.json({ error: "Process ID is required" }, { status: 400 })
    }

    // Get status from the same map used in start-introspection
    const status = getJob(processId)

    if (!status) {
      return NextResponse.json({ error: "Process not found" }, { status: 404 })
    }

    // Clean up terminal processes after 5 minutes
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    const terminal =
      status.status === "completed" || status.status === "error" || status.status === "cancelled"
    if (terminal && status.startTime < fiveMinutesAgo) {
      deleteJob(processId)
    }

    return NextResponse.json(status)
  } catch (error) {
    console.error("Error checking process status:", error)
    return NextResponse.json({ error: "Failed to check process status" }, { status: 500 })
  }
}

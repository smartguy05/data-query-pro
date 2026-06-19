import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryTabContent } from "@/components/query-tab-content"
import type { QueryTab } from "@/models/query-tab.interface"

const baseTab = (overrides: Partial<QueryTab> = {}): QueryTab => ({
  id: "t1",
  type: "original",
  question: "show me sales",
  parentTabId: null,
  isGenerating: false,
  isExecuting: false,
  queryResult: { sql: "SELECT 1", explanation: "demo", confidence: 0.9, warnings: [] },
  editableSql: "SELECT 1",
  createdAt: "2026-06-18T00:00:00.000Z",
  ...overrides,
})

const noop = () => {}

const renderTab = (tab: QueryTab, onVoteAccuracy?: (v: "up" | "down") => void) =>
  render(
    <QueryTabContent
      tab={tab}
      onEditSql={noop}
      onExecute={noop}
      onAskFollowUp={noop}
      onSaveReport={noop}
      onVoteAccuracy={onVoteAccuracy}
      isExecuting={false}
    />
  )

describe("QueryTabContent accuracy feedback", () => {
  it("does not render the thumbs before an execution has occurred", () => {
    renderTab(baseTab(), vi.fn())
    expect(screen.queryByLabelText("Mark query result as correct")).not.toBeInTheDocument()
  })

  it("does not render the thumbs when onVoteAccuracy is not provided", () => {
    renderTab(baseTab({ accuracyBaselineSuccess: true }))
    expect(screen.queryByLabelText("Mark query result as correct")).not.toBeInTheDocument()
  })

  it("calls onVoteAccuracy('down') when downvoting a successful run", async () => {
    const onVote = vi.fn()
    renderTab(baseTab({ accuracyBaselineSuccess: true }), onVote)
    await userEvent.click(screen.getByLabelText("Mark query result as incorrect"))
    expect(onVote).toHaveBeenCalledTimes(1)
    expect(onVote).toHaveBeenCalledWith("down")
  })

  it("calls onVoteAccuracy('up') when upvoting a failed run", async () => {
    const onVote = vi.fn()
    renderTab(baseTab({ accuracyBaselineSuccess: false, executionError: "boom" }), onVote)
    await userEvent.click(screen.getByLabelText("Mark query result as correct"))
    expect(onVote).toHaveBeenCalledTimes(1)
    expect(onVote).toHaveBeenCalledWith("up")
  })

  it("reflects an existing vote as the active state", () => {
    renderTab(baseTab({ accuracyBaselineSuccess: false, accuracyVote: "up" }), vi.fn())
    // effective verdict = vote 'up' → the up button is pressed
    expect(screen.getByLabelText("Mark query result as correct")).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByLabelText("Mark query result as incorrect")).toHaveAttribute("aria-pressed", "false")
  })
})

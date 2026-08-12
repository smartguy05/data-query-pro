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

function renderTab(
  tab: QueryTab,
  props: {
    isExecuting?: boolean
    isCancelling?: boolean
    onCancel?: () => void
  } = {}
) {
  return render(
    <QueryTabContent
      tab={tab}
      onEditSql={noop}
      onExecute={noop}
      onAskFollowUp={noop}
      onSaveReport={noop}
      isExecuting={props.isExecuting ?? false}
      isCancelling={props.isCancelling}
      onCancel={props.onCancel}
    />
  )
}

describe("QueryTabContent cancel button", () => {
  it("is hidden while idle", () => {
    renderTab(baseTab(), { onCancel: vi.fn() })
    expect(screen.queryByRole("button", { name: /cancel/i })).not.toBeInTheDocument()
  })

  it("is hidden when no onCancel is supplied (engines that cannot cancel, e.g. SQLite)", () => {
    renderTab(baseTab({ isExecuting: true }), { isExecuting: true })
    expect(screen.queryByRole("button", { name: /cancel/i })).not.toBeInTheDocument()
    // ...while the query is still visibly running.
    expect(screen.getByRole("button", { name: /executing/i })).toBeInTheDocument()
  })

  it("appears while executing and calls onCancel when clicked", async () => {
    const onCancel = vi.fn()
    renderTab(baseTab({ isExecuting: true }), { isExecuting: true, onCancel })

    const cancel = screen.getByRole("button", { name: /^cancel$/i })
    await userEvent.click(cancel)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it("shows a pending state and blocks repeat clicks while cancelling", async () => {
    const onCancel = vi.fn()
    renderTab(baseTab({ isExecuting: true }), {
      isExecuting: true,
      isCancelling: true,
      onCancel,
    })

    const cancel = screen.getByRole("button", { name: /cancelling/i })
    expect(cancel).toBeDisabled()
    await userEvent.click(cancel)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it("keeps Execute disabled while executing, so cancel is the only action", () => {
    renderTab(baseTab({ isExecuting: true }), { isExecuting: true, onCancel: vi.fn() })
    // This is why cancel is a sibling button rather than an X inside Execute: a
    // disabled button blocks pointer events on its children.
    expect(screen.getByRole("button", { name: /executing/i })).toBeDisabled()
  })
})

describe("QueryTabContent cancelled state", () => {
  it("reports a cancellation without treating it as an error", () => {
    renderTab(baseTab({ executionCancelled: true }))

    expect(screen.getByText("Query cancelled.")).toBeInTheDocument()
    // Not a destructive alert, and crucially no "revise" offer — a cancelled
    // query was not wrong, so there is nothing to fix.
    expect(screen.queryByRole("button", { name: /revise/i })).not.toBeInTheDocument()
    expect(document.querySelector(".text-destructive")).toBeNull()
  })

  it("shows the error instead when an execution actually failed", () => {
    renderTab(baseTab({ executionError: "relation does not exist" }))
    expect(screen.getByText("relation does not exist")).toBeInTheDocument()
    expect(screen.queryByText("Query cancelled.")).not.toBeInTheDocument()
  })

  it("prefers the error over the cancelled notice if somehow both are set", () => {
    renderTab(baseTab({ executionCancelled: true, executionError: "boom" }))
    expect(screen.getByText("boom")).toBeInTheDocument()
    expect(screen.queryByText("Query cancelled.")).not.toBeInTheDocument()
  })
})

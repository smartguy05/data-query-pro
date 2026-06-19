import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ExecutiveMetrics, type KpiMetric } from "@/components/executive-metrics"

const metric = (overrides: Partial<KpiMetric> & { reportId: string; title: string }): KpiMetric => ({
  value: "100",
  status: "neutral",
  ...overrides,
})

describe("ExecutiveMetrics", () => {
  it("renders nothing when metrics is empty", () => {
    const { container } = render(<ExecutiveMetrics metrics={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders a row per metric with title and value", () => {
    const metrics = [
      metric({ reportId: "r1", title: "Revenue", value: "$1,000" }),
      metric({ reportId: "r2", title: "Signups", value: "42" }),
    ]
    render(<ExecutiveMetrics metrics={metrics} />)

    expect(screen.getByText("Revenue")).toBeInTheDocument()
    expect(screen.getByText("$1,000")).toBeInTheDocument()
    expect(screen.getByText("Signups")).toBeInTheDocument()
    expect(screen.getByText("42")).toBeInTheDocument()
  })

  it("shows a Target badge only when target is set", () => {
    const metrics = [
      metric({ reportId: "r1", title: "WithTarget", value: "10", target: "20" }),
      metric({ reportId: "r2", title: "NoTarget", value: "5" }),
    ]
    render(<ExecutiveMetrics metrics={metrics} />)

    expect(screen.getByText("Target: 20")).toBeInTheDocument()
    expect(screen.queryByText(/Target: (?!20)/)).not.toBeInTheDocument()
    // Exactly one target badge exists.
    expect(screen.getAllByText(/^Target:/)).toHaveLength(1)
  })

  it("renders the description when present", () => {
    render(
      <ExecutiveMetrics
        metrics={[metric({ reportId: "r1", title: "Revenue", description: "Total monthly revenue" })]}
      />
    )
    expect(screen.getByText("Total monthly revenue")).toBeInTheDocument()
  })

  it("calls onRemove(reportId) when the remove button is clicked", async () => {
    const onRemove = vi.fn()
    render(
      <ExecutiveMetrics
        metrics={[metric({ reportId: "report-99", title: "Revenue" })]}
        onRemove={onRemove}
      />
    )

    const button = screen.getByRole("button", { name: "Remove Revenue from dashboard" })
    await userEvent.click(button)

    expect(onRemove).toHaveBeenCalledTimes(1)
    expect(onRemove).toHaveBeenCalledWith("report-99")
  })

  it("does not render remove buttons when onRemove is not provided", () => {
    render(<ExecutiveMetrics metrics={[metric({ reportId: "r1", title: "Revenue" })]} />)
    expect(screen.queryByRole("button", { name: /Remove .* from dashboard/ })).not.toBeInTheDocument()
  })
})

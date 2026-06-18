import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ChartCustomizer } from "@/components/chart-customizer"
import type { BarChartConfig } from "@/models/chart-config.interface"

// NOTE: Radix Select popovers are flaky/unsupported in jsdom, so we never open them.
// We only assert that the customizer renders for a config and that editing PLAIN
// inputs (title text, axis-label text, native color input) fires onChange.

const COLUMNS = ["month", "revenue", "cost"]

const barConfig: BarChartConfig = {
  type: "bar",
  title: "Sales",
  xAxisColumn: "month",
  yAxisColumns: ["revenue"],
}

describe("ChartCustomizer — render smoke", () => {
  it("renders with the title input populated from config", () => {
    render(<ChartCustomizer config={barConfig} columns={COLUMNS} onChange={vi.fn()} />)
    const titleInput = screen.getByPlaceholderText("Chart title") as HTMLInputElement
    expect(titleInput).toBeInTheDocument()
    expect(titleInput.value).toBe("Sales")
  })

  it("shows the X/Y axis label inputs for a bar (non-pie) chart", () => {
    render(<ChartCustomizer config={barConfig} columns={COLUMNS} onChange={vi.fn()} />)
    expect(screen.getByLabelText("X-Axis Label")).toBeInTheDocument()
    expect(screen.getByLabelText("Y-Axis Label")).toBeInTheDocument()
  })
})

describe("ChartCustomizer — plain input onChange", () => {
  it("fires onChange with the updated title when typing in the title input", async () => {
    const onChange = vi.fn()
    render(<ChartCustomizer config={barConfig} columns={COLUMNS} onChange={onChange} />)

    const titleInput = screen.getByPlaceholderText("Chart title")
    await userEvent.type(titleInput, "X")

    expect(onChange).toHaveBeenCalled()
    const last = onChange.mock.calls.at(-1)![0]
    // Controlled input: each keystroke patches title onto the existing config.
    expect(last.title).toBe("SalesX")
    expect(last.type).toBe("bar")
    expect(last.xAxisColumn).toBe("month")
  })

  it("fires onChange with xAxisLabel when typing in the X-Axis Label input", async () => {
    const onChange = vi.fn()
    render(<ChartCustomizer config={barConfig} columns={COLUMNS} onChange={onChange} />)

    const xLabel = screen.getByLabelText("X-Axis Label")
    await userEvent.type(xLabel, "M")

    expect(onChange).toHaveBeenCalled()
    const last = onChange.mock.calls.at(-1)![0]
    expect(last.xAxisLabel).toBe("M")
  })

  it("fires onChange with yAxisLabel when typing in the Y-Axis Label input", async () => {
    const onChange = vi.fn()
    render(<ChartCustomizer config={barConfig} columns={COLUMNS} onChange={onChange} />)

    // The input is controlled against the static `config` prop (the parent never
    // re-renders here), so successive keystrokes each patch a fresh single char.
    // Type one char to assert the patch wiring cleanly.
    const yLabel = screen.getByLabelText("Y-Axis Label")
    await userEvent.type(yLabel, "U")

    const last = onChange.mock.calls.at(-1)![0]
    expect(last.yAxisLabel).toBe("U")
  })

  it("fires onChange with updated series colors when changing the native color input", () => {
    const onChange = vi.fn()
    render(<ChartCustomizer config={barConfig} columns={COLUMNS} onChange={onChange} />)

    // The custom color picker is a native <input type="color"> labeled "Custom color".
    const colorInput = screen.getByLabelText("Custom color") as HTMLInputElement
    // userEvent.type isn't supported for color inputs; use fireEvent.change so React's
    // synthetic onChange fires.
    fireEvent.change(colorInput, { target: { value: "#abcdef" } })

    expect(onChange).toHaveBeenCalled()
    const last = onChange.mock.calls.at(-1)![0]
    // bar has one series (revenue) -> colors[0] becomes the chosen hex.
    expect(last.colors[0]).toBe("#abcdef")
  })

  it("renders pie config without axis-label inputs (hasAxes is false)", () => {
    const pie = { type: "pie" as const, title: "Share", nameColumn: "month", valueColumn: "revenue" }
    render(<ChartCustomizer config={pie} columns={COLUMNS} onChange={vi.fn()} />)
    expect(screen.getByPlaceholderText("Chart title")).toBeInTheDocument()
    expect(screen.queryByLabelText("X-Axis Label")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Y-Axis Label")).not.toBeInTheDocument()
  })
})

import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DirtyReadToggle } from "@/components/dirty-read-toggle"

const NO_EFFECT = "No effect on this database"

describe("DirtyReadToggle", () => {
  it("reflects the current value", () => {
    const { rerender } = render(
      <DirtyReadToggle value={false} onChange={vi.fn()} databaseType="sqlserver" />
    )
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false")

    rerender(<DirtyReadToggle value={true} onChange={vi.fn()} databaseType="sqlserver" />)
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true")
  })

  it("calls onChange with the toggled value", async () => {
    const onChange = vi.fn()
    render(<DirtyReadToggle value={false} onChange={onChange} databaseType="mysql" />)

    await userEvent.click(screen.getByRole("switch"))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it("does not fire onChange when disabled", async () => {
    const onChange = vi.fn()
    render(<DirtyReadToggle value={false} onChange={onChange} databaseType="mysql" disabled />)

    await userEvent.click(screen.getByRole("switch"))
    expect(onChange).not.toHaveBeenCalled()
  })

  it("renders a help affordance without needing an external TooltipProvider", () => {
    // Radix throws if no provider is in scope and there is none in app/layout.tsx,
    // so the component must bring its own. Rendering at all proves it does.
    render(<DirtyReadToggle value={false} onChange={vi.fn()} databaseType="sqlserver" />)
    expect(screen.getByLabelText("About dirty reads")).toBeInTheDocument()
  })

  describe("engines with a real dirty-read mode", () => {
    for (const databaseType of ["mysql", "sqlserver"]) {
      it(`does not warn about a no-op on ${databaseType}`, () => {
        render(<DirtyReadToggle value={true} onChange={vi.fn()} databaseType={databaseType} />)
        expect(screen.queryByText(NO_EFFECT)).not.toBeInTheDocument()
      })
    }
  })

  describe("engines without a dirty-read mode", () => {
    for (const databaseType of ["postgresql", "sqlite"]) {
      it(`says the setting does nothing on ${databaseType}`, () => {
        render(<DirtyReadToggle value={true} onChange={vi.fn()} databaseType={databaseType} />)
        expect(screen.getByText(NO_EFFECT)).toBeInTheDocument()
      })

      it(`stays enabled and checked on ${databaseType} so it can be pre-set for another connection`, async () => {
        // Deliberate UX decision: the preference is global, so a user on an engine
        // that ignores it must still be able to turn it on for a different one.
        const onChange = vi.fn()
        render(<DirtyReadToggle value={true} onChange={onChange} databaseType={databaseType} />)

        const toggle = screen.getByRole("switch")
        expect(toggle).not.toBeDisabled()
        expect(toggle).toHaveAttribute("aria-checked", "true")

        await userEvent.click(toggle)
        expect(onChange).toHaveBeenCalledWith(false)
      })
    }
  })

  it("treats an unknown or missing database type as unsupported", () => {
    const { rerender } = render(<DirtyReadToggle value={false} onChange={vi.fn()} />)
    expect(screen.getByText(NO_EFFECT)).toBeInTheDocument()

    rerender(<DirtyReadToggle value={false} onChange={vi.fn()} databaseType="oracle" />)
    expect(screen.getByText(NO_EFFECT)).toBeInTheDocument()
  })
})

import { describe, it, expect } from "vitest"
import { reshapeChartConfig } from "@/components/chart-customizer"
import type {
  ChartConfig,
  BarChartConfig,
  LineChartConfig,
  AreaChartConfig,
  PieChartConfig,
  ScatterChartConfig,
  ComposedChartConfig,
} from "@/models/chart-config.interface"

const COLUMNS = ["month", "revenue", "cost", "profit"]

const baseBar: BarChartConfig = {
  type: "bar",
  title: "My Title",
  description: "My Desc",
  colors: ["#111111", "#222222"],
  xAxisColumn: "month",
  yAxisColumns: ["revenue", "cost"],
}

describe("reshapeChartConfig — metadata carry-over", () => {
  it("carries title/description/colors across bar -> line", () => {
    const result = reshapeChartConfig(baseBar, "line", COLUMNS) as LineChartConfig
    expect(result.type).toBe("line")
    expect(result.title).toBe("My Title")
    expect(result.description).toBe("My Desc")
    expect(result.colors).toEqual(["#111111", "#222222"])
  })

  it("preserves x-axis and series when still available (bar -> area)", () => {
    const result = reshapeChartConfig(baseBar, "area", COLUMNS) as AreaChartConfig
    expect(result.type).toBe("area")
    expect(result.xAxisColumn).toBe("month")
    expect(result.yAxisColumns).toEqual(["revenue", "cost"])
  })
})

describe("reshapeChartConfig — bar/line/area defaults & preservation", () => {
  it("line gets showDots: true and preserves series", () => {
    const result = reshapeChartConfig(baseBar, "line", COLUMNS) as LineChartConfig
    expect(result.xAxisColumn).toBe("month")
    expect(result.yAxisColumns).toEqual(["revenue", "cost"])
    expect(result.showDots).toBe(true)
  })

  it("drops series columns that no longer exist, falling back to the first non-x column", () => {
    const prev: BarChartConfig = {
      type: "bar",
      xAxisColumn: "month",
      yAxisColumns: ["ghost_a", "ghost_b"], // not in COLUMNS
    }
    const result = reshapeChartConfig(prev, "bar", COLUMNS) as BarChartConfig
    // prevSeries filters to [] -> falls back to first column that isn't x.
    expect(result.yAxisColumns).toEqual(["revenue"])
  })

  it("defaults x to the first column when prev has none", () => {
    const result = reshapeChartConfig(undefined, "bar", COLUMNS) as BarChartConfig
    expect(result.xAxisColumn).toBe("month")
    expect(result.yAxisColumns).toEqual(["revenue"])
  })
})

describe("reshapeChartConfig — pie", () => {
  it("maps x -> nameColumn, first series -> valueColumn, showLabels true", () => {
    const result = reshapeChartConfig(baseBar, "pie", COLUMNS) as PieChartConfig
    expect(result.type).toBe("pie")
    expect(result.nameColumn).toBe("month")
    expect(result.valueColumn).toBe("revenue")
    expect(result.showLabels).toBe(true)
    expect(result.title).toBe("My Title")
  })

  it("reads nameColumn back as x when starting from a pie", () => {
    const prevPie: PieChartConfig = {
      type: "pie",
      nameColumn: "month",
      valueColumn: "profit",
    }
    const result = reshapeChartConfig(prevPie, "bar", COLUMNS) as BarChartConfig
    expect(result.xAxisColumn).toBe("month")
    // pie valueColumn becomes the carried series.
    expect(result.yAxisColumns).toEqual(["profit"])
  })
})

describe("reshapeChartConfig — scatter", () => {
  it("maps x -> xAxisColumn, first series -> yAxisColumn, color from colors[0]", () => {
    const result = reshapeChartConfig(baseBar, "scatter", COLUMNS) as ScatterChartConfig
    expect(result.type).toBe("scatter")
    expect(result.xAxisColumn).toBe("month")
    expect(result.yAxisColumn).toBe("revenue")
    expect(result.color).toBe("#111111")
  })

  it("reads a scatter's single yAxisColumn back as the carried series", () => {
    const prevScatter: ScatterChartConfig = {
      type: "scatter",
      xAxisColumn: "month",
      yAxisColumn: "cost",
    }
    const result = reshapeChartConfig(prevScatter, "bar", COLUMNS) as BarChartConfig
    expect(result.yAxisColumns).toEqual(["cost"])
  })
})

describe("reshapeChartConfig — composed", () => {
  it("puts carried series into bars, with empty lines/areas", () => {
    const result = reshapeChartConfig(baseBar, "composed", COLUMNS) as ComposedChartConfig
    expect(result.type).toBe("composed")
    expect(result.xAxisColumn).toBe("month")
    expect(result.bars).toEqual(["revenue", "cost"])
    expect(result.areas).toEqual([])
    expect(result.lines).toEqual([])
  })

  it("flattens bars+areas+lines back into the series list when reshaping away from composed", () => {
    const prevComposed: ComposedChartConfig = {
      type: "composed",
      xAxisColumn: "month",
      bars: ["revenue"],
      areas: ["cost"],
      lines: ["profit"],
    }
    const result = reshapeChartConfig(prevComposed, "bar", COLUMNS) as BarChartConfig
    expect(result.yAxisColumns).toEqual(["revenue", "cost", "profit"])
  })
})

describe("reshapeChartConfig — edge cases", () => {
  it("handles an empty columns array (x and series become empty strings/lists)", () => {
    const result = reshapeChartConfig(undefined, "bar", []) as BarChartConfig
    expect(result.xAxisColumn).toBe("")
    expect(result.yAxisColumns).toEqual([])
  })

  it("round-trips through all chart types without throwing", () => {
    const types: ChartConfig["type"][] = ["bar", "line", "area", "pie", "scatter", "composed"]
    let cfg: ChartConfig | undefined = baseBar
    for (const t of types) {
      cfg = reshapeChartConfig(cfg, t, COLUMNS)
      expect(cfg.type).toBe(t)
      expect(cfg.title).toBe("My Title")
    }
  })
})

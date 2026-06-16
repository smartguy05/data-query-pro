import { LineChartComponent } from "data-query-pro";

const latencyOverTime = [
  { hour: "00:00", p50: 42, p95: 120 },
  { hour: "04:00", p50: 38, p95: 110 },
  { hour: "08:00", p50: 61, p95: 180 },
  { hour: "12:00", p50: 88, p95: 240 },
  { hour: "16:00", p50: 74, p95: 210 },
  { hour: "20:00", p50: 53, p95: 150 },
];

export const QueryLatency = () => (
  <div className="h-[420px] w-[520px]">
    <LineChartComponent
      data={latencyOverTime}
      config={{
        type: "line",
        xAxisColumn: "hour",
        yAxisColumns: ["p50", "p95"],
        xAxisLabel: "Time",
        yAxisLabel: "Latency (ms)",
        smooth: true,
      }}
    />
  </div>
);

const revenueTrend = [
  { month: "Jan", revenue: 2100000 },
  { month: "Feb", revenue: 2250000 },
  { month: "Mar", revenue: 2180000 },
  { month: "Apr", revenue: 2320000 },
  { month: "May", revenue: 2450000 },
  { month: "Jun", revenue: 2380000 },
];

export const RevenueTrend = () => (
  <div className="h-[420px] w-[520px]">
    <LineChartComponent
      data={revenueTrend}
      config={{
        type: "line",
        xAxisColumn: "month",
        yAxisColumns: ["revenue"],
        yAxisLabel: "Revenue (USD)",
      }}
    />
  </div>
);

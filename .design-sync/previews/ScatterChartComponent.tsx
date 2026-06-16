import { ScatterChartComponent } from "data-query-pro";

const rowsVsLatency = [
  { rowsScanned: 120, latencyMs: 18, table: "users" },
  { rowsScanned: 4200, latencyMs: 64, table: "orders" },
  { rowsScanned: 9800, latencyMs: 142, table: "events" },
  { rowsScanned: 1500, latencyMs: 38, table: "invoices" },
  { rowsScanned: 24000, latencyMs: 310, table: "logs" },
  { rowsScanned: 600, latencyMs: 22, table: "plans" },
  { rowsScanned: 15800, latencyMs: 205, table: "sessions" },
  { rowsScanned: 3300, latencyMs: 58, table: "tickets" },
];

export const RowsVsLatency = () => (
  <div className="h-[420px] w-[520px]">
    <ScatterChartComponent
      data={rowsVsLatency}
      config={{
        type: "scatter",
        xAxisColumn: "rowsScanned",
        yAxisColumn: "latencyMs",
        nameColumn: "table",
        xAxisLabel: "Rows scanned",
        yAxisLabel: "Latency (ms)",
      }}
    />
  </div>
);

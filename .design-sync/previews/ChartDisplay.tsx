import { ChartDisplay } from "data-query-pro";

export const RevenueBarChart = () => (
  <div className="w-[560px]">
    <ChartDisplay
      config={{
        type: "bar",
        title: "Monthly Revenue",
        description: "Revenue by month for cloudmetrics",
        xAxisColumn: "month",
        yAxisColumns: ["revenue"],
        yAxisLabel: "Revenue (USD)",
      }}
      columns={["month", "revenue"]}
      rows={[
        ["Jan", 2100000],
        ["Feb", 2250000],
        ["Mar", 2180000],
        ["Apr", 2320000],
        ["May", 2450000],
        ["Jun", 2380000],
      ]}
    />
  </div>
);

export const EnginePieChart = () => (
  <div className="w-[560px]">
    <ChartDisplay
      config={{
        type: "pie",
        title: "Connections by Engine",
        description: "Active database connections grouped by engine",
        nameColumn: "engine",
        valueColumn: "connections",
      }}
      columns={["engine", "connections"]}
      rows={[
        ["PostgreSQL", 42],
        ["MySQL", 28],
        ["SQL Server", 16],
        ["SQLite", 9],
      ]}
    />
  </div>
);

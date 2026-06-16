import { BarChartComponent } from "data-query-pro";

const queriesByDatabase = [
  { database: "cloudmetrics", queries: 1840 },
  { database: "billing", queries: 1320 },
  { database: "analytics", queries: 980 },
  { database: "inventory", queries: 640 },
  { database: "support", queries: 410 },
];

export const QueriesByDatabase = () => (
  <div className="h-[420px] w-[520px]">
    <BarChartComponent
      data={queriesByDatabase}
      config={{
        type: "bar",
        xAxisColumn: "database",
        yAxisColumns: ["queries"],
        xAxisLabel: "Database",
        yAxisLabel: "Queries (24h)",
      }}
    />
  </div>
);

const planMix = [
  { plan: "Starter", active: 420, churned: 60 },
  { plan: "Pro", active: 980, churned: 90 },
  { plan: "Team", active: 540, churned: 40 },
  { plan: "Enterprise", active: 210, churned: 12 },
];

export const GroupedPlans = () => (
  <div className="h-[420px] w-[520px]">
    <BarChartComponent
      data={planMix}
      config={{
        type: "bar",
        xAxisColumn: "plan",
        yAxisColumns: ["active", "churned"],
        yAxisLabel: "Accounts",
      }}
    />
  </div>
);

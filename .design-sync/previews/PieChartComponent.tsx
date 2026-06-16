import { PieChartComponent } from "data-query-pro";

const engineShare = [
  { engine: "PostgreSQL", connections: 42 },
  { engine: "MySQL", connections: 28 },
  { engine: "SQL Server", connections: 16 },
  { engine: "SQLite", connections: 9 },
];

export const ConnectionsByEngine = () => (
  <div className="h-[420px] w-[520px]">
    <PieChartComponent
      data={engineShare}
      config={{
        type: "pie",
        nameColumn: "engine",
        valueColumn: "connections",
      }}
    />
  </div>
);

const revenueByRegion = [
  { region: "North America", revenue: 1240000 },
  { region: "Europe", revenue: 860000 },
  { region: "Asia Pacific", revenue: 540000 },
  { region: "Latin America", revenue: 210000 },
];

export const RevenueByRegion = () => (
  <div className="h-[420px] w-[520px]">
    <PieChartComponent
      data={revenueByRegion}
      config={{
        type: "pie",
        nameColumn: "region",
        valueColumn: "revenue",
      }}
    />
  </div>
);

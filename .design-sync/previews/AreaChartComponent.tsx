import { AreaChartComponent } from "data-query-pro";

const requestVolume = [
  { day: "Mon", reads: 8200, writes: 1900 },
  { day: "Tue", reads: 9100, writes: 2100 },
  { day: "Wed", reads: 8700, writes: 1750 },
  { day: "Thu", reads: 10400, writes: 2480 },
  { day: "Fri", reads: 11200, writes: 2950 },
  { day: "Sat", reads: 6400, writes: 1200 },
  { day: "Sun", reads: 5800, writes: 980 },
];

export const RequestVolume = () => (
  <div className="h-[420px] w-[520px]">
    <AreaChartComponent
      data={requestVolume}
      config={{
        type: "area",
        xAxisColumn: "day",
        yAxisColumns: ["reads", "writes"],
        xAxisLabel: "Day",
        yAxisLabel: "Operations",
        stacked: true,
      }}
    />
  </div>
);

const storageGrowth = [
  { month: "Jan", gb: 120 },
  { month: "Feb", gb: 148 },
  { month: "Mar", gb: 171 },
  { month: "Apr", gb: 205 },
  { month: "May", gb: 244 },
  { month: "Jun", gb: 298 },
];

export const StorageGrowth = () => (
  <div className="h-[420px] w-[520px]">
    <AreaChartComponent
      data={storageGrowth}
      config={{
        type: "area",
        xAxisColumn: "month",
        yAxisColumns: ["gb"],
        yAxisLabel: "Storage (GB)",
      }}
    />
  </div>
);

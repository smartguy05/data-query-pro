import { ChartContainer } from "data-query-pro";
import { BarChart, Bar, XAxis, CartesianGrid, LineChart, Line } from "recharts";

const queries = [
  { database: "cloudmetrics", queries: 1840 },
  { database: "billing", queries: 1320 },
  { database: "analytics", queries: 980 },
  { database: "inventory", queries: 640 },
  { database: "support", queries: 410 },
];

export const QueriesBar = () => (
  <div className="h-[300px] w-[480px]">
    <ChartContainer
      className="h-[300px] w-[480px]"
      config={{ queries: { label: "Queries", color: "hsl(var(--chart-1))" } }}
    >
      <BarChart data={queries} margin={{ top: 16, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="database" tickLine={false} axisLine={false} />
        <Bar dataKey="queries" fill="var(--color-queries)" radius={4} isAnimationActive={false} />
      </BarChart>
    </ChartContainer>
  </div>
);

const latency = [
  { hour: "00:00", p95: 120 },
  { hour: "04:00", p95: 110 },
  { hour: "08:00", p95: 180 },
  { hour: "12:00", p95: 240 },
  { hour: "16:00", p95: 210 },
  { hour: "20:00", p95: 150 },
];

export const LatencyLine = () => (
  <div className="h-[300px] w-[480px]">
    <ChartContainer
      className="h-[300px] w-[480px]"
      config={{ p95: { label: "p95 latency (ms)", color: "hsl(var(--chart-2))" } }}
    >
      <LineChart data={latency} margin={{ top: 16, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="hour" tickLine={false} axisLine={false} />
        <Line dataKey="p95" stroke="var(--color-p95)" strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ChartContainer>
  </div>
);

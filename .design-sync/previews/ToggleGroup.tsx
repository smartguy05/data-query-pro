import { ToggleGroup, ToggleGroupItem } from "data-query-pro";
import { BarChart3, LineChart, PieChart, Table2, AlignLeft, AlignCenter, AlignRight } from "lucide-react";

export const ViewMode = () => (
  <ToggleGroup type="single" defaultValue="table">
    <ToggleGroupItem value="table" aria-label="Table view">
      <Table2 /> Table
    </ToggleGroupItem>
    <ToggleGroupItem value="chart" aria-label="Chart view">
      <BarChart3 /> Chart
    </ToggleGroupItem>
  </ToggleGroup>
);

export const ChartTypeOutline = () => (
  <ToggleGroup type="single" defaultValue="bar" variant="outline">
    <ToggleGroupItem value="bar" aria-label="Bar"><BarChart3 /></ToggleGroupItem>
    <ToggleGroupItem value="line" aria-label="Line"><LineChart /></ToggleGroupItem>
    <ToggleGroupItem value="pie" aria-label="Pie"><PieChart /></ToggleGroupItem>
  </ToggleGroup>
);

export const Multiple = () => (
  <ToggleGroup type="multiple" defaultValue={["left"]} variant="outline">
    <ToggleGroupItem value="left" aria-label="Align left"><AlignLeft /></ToggleGroupItem>
    <ToggleGroupItem value="center" aria-label="Align center"><AlignCenter /></ToggleGroupItem>
    <ToggleGroupItem value="right" aria-label="Align right"><AlignRight /></ToggleGroupItem>
  </ToggleGroup>
);

export const Sizes = () => (
  <div className="flex flex-col gap-3">
    <ToggleGroup type="single" defaultValue="d" size="sm" variant="outline">
      <ToggleGroupItem value="d">Day</ToggleGroupItem>
      <ToggleGroupItem value="w">Week</ToggleGroupItem>
      <ToggleGroupItem value="m">Month</ToggleGroupItem>
    </ToggleGroup>
    <ToggleGroup type="single" defaultValue="w" size="lg" variant="outline">
      <ToggleGroupItem value="d">Day</ToggleGroupItem>
      <ToggleGroupItem value="w">Week</ToggleGroupItem>
      <ToggleGroupItem value="m">Month</ToggleGroupItem>
    </ToggleGroup>
  </div>
);

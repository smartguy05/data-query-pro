import { AspectRatio, Badge } from "data-query-pro";
import { BarChart3, PieChart } from "lucide-react";

export const ChartPreview = () => (
  <div className="w-[400px]">
    <AspectRatio ratio={16 / 9} className="rounded-md border bg-muted">
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <BarChart3 className="h-10 w-10" />
        <span className="text-sm">Revenue by Region — 16:9</span>
      </div>
    </AspectRatio>
  </div>
);

export const ReportThumb = () => (
  <div className="w-[280px]">
    <AspectRatio ratio={1} className="rounded-md border bg-muted">
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <PieChart className="h-10 w-10" />
        <Badge variant="secondary">cloudmetrics</Badge>
      </div>
    </AspectRatio>
  </div>
);

import { Separator } from "data-query-pro";

export const ConnectionMeta = () => (
  <div className="w-[420px]">
    <div className="space-y-1">
      <h4 className="text-sm font-medium leading-none">cloudmetrics</h4>
      <p className="text-sm text-muted-foreground">
        PostgreSQL connection — 12 tables, schema uploaded.
      </p>
    </div>
    <Separator className="my-4" />
    <div className="flex h-5 items-center space-x-4 text-sm text-muted-foreground">
      <span>localhost:5432</span>
      <Separator orientation="vertical" />
      <span>demo</span>
      <Separator orientation="vertical" />
      <span>Connected</span>
    </div>
  </div>
);

export const ReportFooter = () => (
  <div className="w-[420px] rounded-md border p-4">
    <div className="text-sm font-medium">Monthly Revenue by Region</div>
    <Separator className="my-3" />
    <div className="flex items-center justify-between text-xs text-muted-foreground">
      <span>Last run: 2 hours ago</span>
      <span>248 rows</span>
    </div>
  </div>
);

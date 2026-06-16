import { ScrollArea, Separator } from "data-query-pro";

const tables = [
  "public.orders",
  "public.customers",
  "public.invoices",
  "public.line_items",
  "public.payments",
  "public.regions",
  "public.products",
  "public.shipments",
  "public.refunds",
  "public.audit_log",
  "public.users",
  "public.sessions",
];

export const TableList = () => (
  <ScrollArea className="h-[280px] w-[300px] rounded-md border">
    <div className="p-4">
      <h4 className="mb-2 text-sm font-medium leading-none">Tables (12)</h4>
      {tables.map((t) => (
        <div key={t}>
          <div className="py-2 text-sm text-muted-foreground">{t}</div>
          <Separator />
        </div>
      ))}
    </div>
  </ScrollArea>
);

export const QueryHistory = () => (
  <ScrollArea className="h-[240px] w-[420px] rounded-md border">
    <div className="space-y-3 p-4 text-sm">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="rounded-md bg-muted p-2 font-mono text-xs text-muted-foreground">
          SELECT * FROM orders LIMIT {(i + 1) * 10};
        </div>
      ))}
    </div>
  </ScrollArea>
);

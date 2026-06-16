import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  Button,
} from "data-query-pro";
import { ChevronsUpDown, Code } from "lucide-react";

export const GeneratedSql = () => (
  <div className="w-[460px] rounded-md border p-4">
    <Collapsible defaultOpen>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Code className="h-4 w-4" /> Generated SQL
        </div>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm">
            Toggle
            <ChevronsUpDown className="h-4 w-4" />
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="mt-3">
        <pre className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
{`SELECT customer_id, SUM(total) AS revenue
FROM public.orders
WHERE status = 'paid'
GROUP BY customer_id
ORDER BY revenue DESC
LIMIT 10;`}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  </div>
);

export const QueryWarnings = () => (
  <div className="w-[460px] rounded-md border p-4">
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-between">
          3 query warnings
          <ChevronsUpDown className="h-4 w-4" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-2 text-sm text-muted-foreground">
        <p>No index on orders.status — full table scan likely.</p>
        <p>Result set capped at 1,000 rows.</p>
        <p>Column total has NULL values that were excluded.</p>
      </CollapsibleContent>
    </Collapsible>
  </div>
);

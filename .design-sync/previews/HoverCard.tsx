import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
  Badge,
  Button,
} from "data-query-pro";
import { Table2 } from "lucide-react";

export const TableSchemaHoverCard = () => (
  <HoverCard open>
    <HoverCardTrigger asChild>
      <Button variant="link" className="font-mono">
        invoices
      </Button>
    </HoverCardTrigger>
    <HoverCardContent className="w-80" align="start">
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-muted">
          <Table2 className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-semibold">public.invoices</h4>
          <p className="text-sm text-muted-foreground">
            Customer billing records. One row per issued invoice with amount,
            currency, and billing region.
          </p>
          <div className="flex flex-wrap gap-1 pt-1">
            <Badge variant="secondary">14 columns</Badge>
            <Badge variant="outline">2 foreign keys</Badge>
          </div>
        </div>
      </div>
    </HoverCardContent>
  </HoverCard>
);

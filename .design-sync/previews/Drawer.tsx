import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  Button,
  Badge,
} from "data-query-pro";

export const QueryDetailsDrawer = () => (
  <Drawer open>
    <DrawerContent>
      <div className="mx-auto w-full max-w-2xl">
        <DrawerHeader>
          <DrawerTitle>Generated SQL</DrawerTitle>
          <DrawerDescription>
            From: &quot;Show me total revenue by region for the last quarter&quot;
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-2">
          <div className="mb-3 flex items-center gap-2">
            <Badge variant="secondary">SELECT</Badge>
            <Badge variant="outline">High confidence</Badge>
          </div>
          <pre className="overflow-x-auto rounded-md border bg-muted/50 p-4 text-sm">
            <code>{`SELECT region, SUM(amount) AS total_revenue
FROM invoices
WHERE created_at >= date_trunc('quarter', now())
GROUP BY region
ORDER BY total_revenue DESC;`}</code>
          </pre>
        </div>
        <DrawerFooter>
          <Button>Run query</Button>
          <Button variant="outline">Edit SQL</Button>
        </DrawerFooter>
      </div>
    </DrawerContent>
  </Drawer>
);

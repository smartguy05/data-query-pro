import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "data-query-pro";

export const SchemaAndResults = () => (
  <div className="h-[320px] w-[640px] rounded-md border">
    <ResizablePanelGroup direction="horizontal">
      <ResizablePanel defaultSize={30}>
        <div className="flex h-full flex-col gap-2 p-4 text-sm">
          <span className="font-medium">Tables</span>
          <span className="text-muted-foreground">public.orders</span>
          <span className="text-muted-foreground">public.customers</span>
          <span className="text-muted-foreground">public.invoices</span>
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={70}>
        <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
          Query results — 248 rows
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>
);

export const EditorSplit = () => (
  <div className="h-[280px] w-[640px] rounded-md border">
    <ResizablePanelGroup direction="horizontal">
      <ResizablePanel defaultSize={55}>
        <div className="flex h-full items-center justify-center bg-muted p-4 font-mono text-xs text-muted-foreground">
          SELECT * FROM public.orders;
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={45}>
        <div className="flex h-full flex-col p-4 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Results</span>
          <span>248 rows · 42 ms</span>
          <span>Columns: id, customer_id, total, status</span>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>
);

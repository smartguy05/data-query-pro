import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Badge,
} from "data-query-pro";

export const QueryWorkspace = () => (
  <div className="w-[560px]">
    <Tabs defaultValue="results">
      <TabsList>
        <TabsTrigger value="results">Results</TabsTrigger>
        <TabsTrigger value="sql">SQL</TabsTrigger>
        <TabsTrigger value="chart">Chart</TabsTrigger>
        <TabsTrigger value="explain">Explain</TabsTrigger>
      </TabsList>
      <TabsContent value="results">
        <div className="rounded-md border p-4 text-sm text-muted-foreground">
          Returned 248 rows in 42 ms from cloudmetrics.orders.
        </div>
      </TabsContent>
      <TabsContent value="sql">
        <pre className="rounded-md bg-muted p-4 text-xs text-muted-foreground">
          SELECT * FROM public.orders WHERE status = &apos;paid&apos;;
        </pre>
      </TabsContent>
      <TabsContent value="chart">
        <div className="rounded-md border p-4 text-sm text-muted-foreground">
          Bar chart of revenue by region.
        </div>
      </TabsContent>
      <TabsContent value="explain">
        <div className="rounded-md border p-4 text-sm text-muted-foreground">
          AI explanation of how this query was generated.
        </div>
      </TabsContent>
    </Tabs>
  </div>
);

export const ConnectionTabs = () => (
  <div className="w-[420px]">
    <Tabs defaultValue="postgres">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="postgres">PostgreSQL</TabsTrigger>
        <TabsTrigger value="mysql">MySQL</TabsTrigger>
        <TabsTrigger value="sqlite">SQLite</TabsTrigger>
      </TabsList>
      <TabsContent value="postgres">
        <div className="flex items-center justify-between rounded-md border p-4 text-sm">
          <span>cloudmetrics @ localhost:5432</span>
          <Badge>connected</Badge>
        </div>
      </TabsContent>
      <TabsContent value="mysql">
        <div className="flex items-center justify-between rounded-md border p-4 text-sm">
          <span>analytics @ db.internal:3306</span>
          <Badge variant="secondary">disconnected</Badge>
        </div>
      </TabsContent>
      <TabsContent value="sqlite">
        <div className="rounded-md border p-4 text-sm text-muted-foreground">
          ./data/local.db
        </div>
      </TabsContent>
    </Tabs>
  </div>
);

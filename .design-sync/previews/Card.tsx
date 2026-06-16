import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Badge,
} from "data-query-pro";

export const MetricCard = () => (
  <Card className="w-[360px]">
    <CardHeader>
      <CardTitle>Total Revenue</CardTitle>
      <CardDescription>Last 30 days across all connections</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="text-3xl font-bold">$48,320.55</div>
      <p className="mt-1 text-sm text-muted-foreground">+12.5% from previous period</p>
    </CardContent>
    <CardFooter className="justify-between">
      <Badge variant="secondary">cloudmetrics</Badge>
      <Button size="sm" variant="outline">View report</Button>
    </CardFooter>
  </Card>
);

export const SimpleCard = () => (
  <Card className="w-[360px]">
    <CardHeader>
      <CardTitle>New Connection</CardTitle>
      <CardDescription>Connect a PostgreSQL, MySQL, SQL Server, or SQLite database.</CardDescription>
    </CardHeader>
    <CardFooter>
      <Button>Get started</Button>
    </CardFooter>
  </Card>
);

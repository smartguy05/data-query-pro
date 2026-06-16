import { Input, Label } from "data-query-pro";
import { Search } from "lucide-react";

export const Default = () => (
  <div className="w-[360px] space-y-2">
    <Label htmlFor="db-host">Host</Label>
    <Input id="db-host" defaultValue="db.cloudmetrics.internal" />
  </div>
);

export const Types = () => (
  <div className="w-[360px] space-y-4">
    <div className="space-y-2">
      <Label htmlFor="db-port">Port</Label>
      <Input id="db-port" type="number" defaultValue={5432} />
    </div>
    <div className="space-y-2">
      <Label htmlFor="db-pass">Password</Label>
      <Input id="db-pass" type="password" defaultValue="demo-secret" />
    </div>
  </div>
);

export const Placeholder = () => (
  <div className="w-[360px] space-y-2">
    <Label htmlFor="db-search">Search tables</Label>
    <Input id="db-search" placeholder="Filter cloudmetrics schema..." />
  </div>
);

export const Disabled = () => (
  <div className="w-[360px] space-y-2">
    <Label htmlFor="db-conn">Connection string</Label>
    <Input id="db-conn" disabled defaultValue="postgres://demo@localhost:5432/cloudmetrics" />
  </div>
);

export const WithIcon = () => (
  <div className="w-[360px] space-y-2">
    <Label htmlFor="db-q">Find a report</Label>
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input id="db-q" className="pl-9" placeholder="Monthly revenue by region" />
    </div>
  </div>
);

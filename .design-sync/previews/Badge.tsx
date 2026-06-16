import { Badge } from "data-query-pro";

export const StatusBadges = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Badge>Connected</Badge>
    <Badge variant="secondary">cloudmetrics</Badge>
    <Badge variant="destructive">Disconnected</Badge>
    <Badge variant="outline">Server Config</Badge>
  </div>
);

export const SchemaBadges = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Badge variant="secondary">42 tables</Badge>
    <Badge variant="outline">PostgreSQL</Badge>
    <Badge>New</Badge>
  </div>
);

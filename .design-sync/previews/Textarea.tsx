import { Textarea, Label } from "data-query-pro";

export const Default = () => (
  <div className="w-[420px] space-y-2">
    <Label htmlFor="nl-query">Natural language query</Label>
    <Textarea
      id="nl-query"
      defaultValue="Show me total revenue by region for the last 30 days, sorted descending."
    />
  </div>
);

export const Placeholder = () => (
  <div className="w-[420px] space-y-2">
    <Label htmlFor="conn-desc">Connection description</Label>
    <Textarea
      id="conn-desc"
      placeholder="Describe what this database is used for (e.g. production analytics warehouse)..."
    />
  </div>
);

export const SqlEditor = () => (
  <div className="w-[420px] space-y-2">
    <Label htmlFor="sql">Generated SQL</Label>
    <Textarea
      id="sql"
      className="font-mono text-xs min-h-[120px]"
      defaultValue={"SELECT region, SUM(amount) AS revenue\nFROM orders\nWHERE created_at > now() - interval '30 days'\nGROUP BY region\nORDER BY revenue DESC;"}
    />
  </div>
);

export const Disabled = () => (
  <div className="w-[420px] space-y-2">
    <Label htmlFor="ai-desc">AI table description</Label>
    <Textarea
      id="ai-desc"
      disabled
      defaultValue="The orders table stores customer purchase transactions including amount, region, and status."
    />
  </div>
);

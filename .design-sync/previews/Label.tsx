import { Label, Input, Checkbox } from "data-query-pro";

export const Default = () => (
  <Label htmlFor="db-name">Database name</Label>
);

export const WithInput = () => (
  <div className="w-[360px] space-y-2">
    <Label htmlFor="vector-store">Vector store ID</Label>
    <Input id="vector-store" defaultValue="vs_cloudmetrics_8f2a" />
  </div>
);

export const WithCheckbox = () => (
  <div className="flex items-center gap-2">
    <Checkbox id="hide-table" defaultChecked />
    <Label htmlFor="hide-table">Hide table from AI schema upload</Label>
  </div>
);

export const Required = () => (
  <div className="w-[360px] space-y-2">
    <Label htmlFor="api-key">
      OpenAI API key <span className="text-destructive">*</span>
    </Label>
    <Input id="api-key" type="password" placeholder="sk-..." />
  </div>
);

import { ThemeToggle } from "data-query-pro";

export const ToggleButton = () => (
  <div className="flex items-center gap-2 rounded-md border p-2">
    <ThemeToggle />
    <span className="text-sm text-muted-foreground">Toggle theme</span>
  </div>
);

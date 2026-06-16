import { Button } from "data-query-pro";
import { Play, Plus, Trash2, Download } from "lucide-react";

export const Variants = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button>Run query</Button>
    <Button variant="secondary">Secondary</Button>
    <Button variant="destructive">Delete</Button>
    <Button variant="outline">Outline</Button>
    <Button variant="ghost">Ghost</Button>
    <Button variant="link">Link</Button>
  </div>
);

export const Sizes = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button size="sm">Small</Button>
    <Button size="default">Default</Button>
    <Button size="lg">Large</Button>
    <Button size="icon" aria-label="Add">
      <Plus />
    </Button>
  </div>
);

export const WithIcons = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button>
      <Play /> Run query
    </Button>
    <Button variant="outline">
      <Download /> Export
    </Button>
    <Button variant="destructive">
      <Trash2 /> Delete report
    </Button>
    <Button disabled>Disabled</Button>
  </div>
);

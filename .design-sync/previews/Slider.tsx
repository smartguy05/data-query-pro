import { Slider, Label } from "data-query-pro";

export const Default = () => (
  <div className="w-[360px]">
    <Slider defaultValue={[50]} max={100} step={1} />
  </div>
);

export const RowLimit = () => (
  <div className="w-[360px] space-y-3">
    <div className="flex items-center justify-between">
      <Label htmlFor="row-limit">Max rows returned</Label>
      <span className="text-sm text-muted-foreground">500</span>
    </div>
    <Slider id="row-limit" defaultValue={[500]} max={1000} step={50} />
  </div>
);

export const Range = () => (
  <div className="w-[360px] space-y-3">
    <Label>Query timeout window (seconds)</Label>
    <Slider defaultValue={[5, 30]} max={60} step={5} />
  </div>
);

export const Disabled = () => (
  <div className="w-[360px] space-y-3">
    <Label>Sampling rate (locked)</Label>
    <Slider defaultValue={[25]} max={100} step={1} disabled />
  </div>
);

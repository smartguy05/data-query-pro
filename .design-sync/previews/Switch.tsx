import { Switch, Label } from "data-query-pro";

export const Default = () => (
  <div className="flex items-center gap-3">
    <Switch id="rate-limit" defaultChecked />
    <Label htmlFor="rate-limit">Enable demo rate limiting</Label>
  </div>
);

export const States = () => (
  <div className="flex flex-col gap-4">
    <div className="flex items-center gap-3">
      <Switch id="s-off" />
      <Label htmlFor="s-off">Off</Label>
    </div>
    <div className="flex items-center gap-3">
      <Switch id="s-on" defaultChecked />
      <Label htmlFor="s-on">On</Label>
    </div>
    <div className="flex items-center gap-3">
      <Switch id="s-disabled" disabled />
      <Label htmlFor="s-disabled">Disabled</Label>
    </div>
  </div>
);

export const SettingsList = () => (
  <div className="w-[380px] space-y-4">
    <div className="flex items-center justify-between">
      <Label htmlFor="auto-revise">Auto-revise failed queries</Label>
      <Switch id="auto-revise" defaultChecked />
    </div>
    <div className="flex items-center justify-between">
      <Label htmlFor="dark-mode">Dark mode</Label>
      <Switch id="dark-mode" />
    </div>
    <div className="flex items-center justify-between">
      <Label htmlFor="share-conn">Allow sharing connections</Label>
      <Switch id="share-conn" defaultChecked />
    </div>
  </div>
);

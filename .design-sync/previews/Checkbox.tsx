import { Checkbox, Label } from "data-query-pro";

export const Default = () => (
  <div className="flex items-center gap-2">
    <Checkbox id="ssl" defaultChecked />
    <Label htmlFor="ssl">Require SSL connection</Label>
  </div>
);

export const States = () => (
  <div className="flex flex-col gap-3">
    <div className="flex items-center gap-2">
      <Checkbox id="c-unchecked" />
      <Label htmlFor="c-unchecked">Unchecked</Label>
    </div>
    <div className="flex items-center gap-2">
      <Checkbox id="c-checked" defaultChecked />
      <Label htmlFor="c-checked">Checked</Label>
    </div>
    <div className="flex items-center gap-2">
      <Checkbox id="c-disabled" disabled />
      <Label htmlFor="c-disabled">Disabled</Label>
    </div>
  </div>
);

export const TableList = () => (
  <div className="w-[300px] space-y-3">
    <p className="text-sm font-medium">Include tables in schema</p>
    {[
      { id: "orders", label: "orders", checked: true },
      { id: "customers", label: "customers", checked: true },
      { id: "audit_log", label: "audit_log", checked: false },
    ].map((t) => (
      <div key={t.id} className="flex items-center gap-2">
        <Checkbox id={t.id} defaultChecked={t.checked} />
        <Label htmlFor={t.id} className="font-mono">{t.label}</Label>
      </div>
    ))}
  </div>
);

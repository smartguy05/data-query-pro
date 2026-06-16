import { RadioGroup, RadioGroupItem, Label } from "data-query-pro";

export const DatabaseType = () => (
  <RadioGroup defaultValue="postgresql" className="w-[280px]">
    {[
      { value: "postgresql", label: "PostgreSQL" },
      { value: "mysql", label: "MySQL" },
      { value: "sqlserver", label: "SQL Server" },
      { value: "sqlite", label: "SQLite" },
    ].map((o) => (
      <div key={o.value} className="flex items-center gap-2">
        <RadioGroupItem value={o.value} id={`db-${o.value}`} />
        <Label htmlFor={`db-${o.value}`}>{o.label}</Label>
      </div>
    ))}
  </RadioGroup>
);

export const ChartType = () => (
  <RadioGroup defaultValue="bar" className="grid grid-cols-2 gap-3 w-[320px]">
    {["bar", "line", "pie", "area"].map((o) => (
      <div key={o} className="flex items-center gap-2">
        <RadioGroupItem value={o} id={`chart-${o}`} />
        <Label htmlFor={`chart-${o}`} className="capitalize">{o} chart</Label>
      </div>
    ))}
  </RadioGroup>
);

export const Disabled = () => (
  <RadioGroup defaultValue="view" className="w-[280px]">
    <div className="flex items-center gap-2">
      <RadioGroupItem value="view" id="perm-view" />
      <Label htmlFor="perm-view">View only</Label>
    </div>
    <div className="flex items-center gap-2">
      <RadioGroupItem value="edit" id="perm-edit" />
      <Label htmlFor="perm-edit">Can edit</Label>
    </div>
    <div className="flex items-center gap-2">
      <RadioGroupItem value="admin" id="perm-admin" disabled />
      <Label htmlFor="perm-admin">Admin (requires upgrade)</Label>
    </div>
  </RadioGroup>
);

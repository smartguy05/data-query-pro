import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
} from "data-query-pro";

export const ConnectionSelect = () => (
  <Select defaultOpen defaultValue="cloudmetrics">
    <SelectTrigger className="w-[280px]">
      <SelectValue placeholder="Select a connection" />
    </SelectTrigger>
    <SelectContent>
      <SelectGroup>
        <SelectLabel>Connections</SelectLabel>
        <SelectItem value="cloudmetrics">cloudmetrics (PostgreSQL)</SelectItem>
        <SelectItem value="billing">billing (MySQL)</SelectItem>
        <SelectItem value="analytics">analytics (SQL Server)</SelectItem>
        <SelectItem value="local">local-cache (SQLite)</SelectItem>
      </SelectGroup>
    </SelectContent>
  </Select>
);

import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  Button,
  Input,
  Label,
} from "data-query-pro";

export const ColumnTypePopover = () => (
  <Popover open>
    <PopoverTrigger asChild>
      <Button variant="outline">Column settings</Button>
    </PopoverTrigger>
    <PopoverContent className="w-72" align="start">
      <div className="grid gap-3">
        <div className="space-y-1">
          <h4 className="text-sm font-semibold leading-none">Column type</h4>
          <p className="text-sm text-muted-foreground">
            Override how the <span className="font-mono">amount</span> column is displayed.
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="format">Format</Label>
          <Input id="format" defaultValue="Currency (USD)" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="precision">Decimal places</Label>
          <Input id="precision" defaultValue="2" />
        </div>
        <Button size="sm">Apply</Button>
      </div>
    </PopoverContent>
  </Popover>
);

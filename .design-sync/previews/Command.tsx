import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from "data-query-pro";
import { Database, Table2, FileText, Play, Sparkles } from "lucide-react";

export const QueryCommandPalette = () => (
  <Command className="w-[420px] rounded-lg border shadow-md">
    <CommandInput placeholder="Search tables, reports, or actions..." />
    <CommandList>
      <CommandEmpty>No results found.</CommandEmpty>
      <CommandGroup heading="Saved reports">
        <CommandItem>
          <FileText />
          <span>Monthly revenue by region</span>
          <CommandShortcut>⌘1</CommandShortcut>
        </CommandItem>
        <CommandItem>
          <FileText />
          <span>Active subscriptions by plan</span>
        </CommandItem>
      </CommandGroup>
      <CommandSeparator />
      <CommandGroup heading="Tables">
        <CommandItem>
          <Table2 />
          <span>public.invoices</span>
        </CommandItem>
        <CommandItem>
          <Table2 />
          <span>public.customers</span>
        </CommandItem>
        <CommandItem>
          <Database />
          <span>cloudmetrics</span>
        </CommandItem>
      </CommandGroup>
      <CommandSeparator />
      <CommandGroup heading="Actions">
        <CommandItem>
          <Sparkles />
          <span>Ask AI a new question</span>
        </CommandItem>
        <CommandItem>
          <Play />
          <span>Run last query</span>
          <CommandShortcut>⌘R</CommandShortcut>
        </CommandItem>
      </CommandGroup>
    </CommandList>
  </Command>
);

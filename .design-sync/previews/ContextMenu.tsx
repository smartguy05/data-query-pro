import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuLabel,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuCheckboxItem,
} from "data-query-pro";
import { Copy, Filter, ArrowUpDown, EyeOff, BarChart3 } from "lucide-react";

export const ResultCellContextMenu = () => (
  <ContextMenu open>
    <ContextMenuTrigger asChild>
      <span className="font-mono text-sm">us-east-1</span>
    </ContextMenuTrigger>
    <ContextMenuContent className="w-60">
      <ContextMenuLabel>region = &quot;us-east-1&quot;</ContextMenuLabel>
      <ContextMenuSeparator />
      <ContextMenuItem>
        <Copy /> Copy value
        <ContextMenuShortcut>⌘C</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem>
        <Filter /> Filter by this value
      </ContextMenuItem>
      <ContextMenuItem>
        <ArrowUpDown /> Sort column
      </ContextMenuItem>
      <ContextMenuItem>
        <BarChart3 /> Chart this column
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuCheckboxItem checked>
        <EyeOff /> Show null values
      </ContextMenuCheckboxItem>
    </ContextMenuContent>
  </ContextMenu>
);

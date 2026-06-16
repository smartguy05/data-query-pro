import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  Button,
} from "data-query-pro";
import { MoreHorizontal, Play, Pencil, Copy, Download, Trash2 } from "lucide-react";

export const ReportActionsMenu = () => (
  <DropdownMenu open>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" size="icon" aria-label="Report actions">
        <MoreHorizontal />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" className="w-56">
      <DropdownMenuLabel>Monthly revenue by region</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem>
        <Play /> Run report
        <DropdownMenuShortcut>⌘R</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem>
        <Pencil /> Edit
      </DropdownMenuItem>
      <DropdownMenuItem>
        <Copy /> Duplicate
      </DropdownMenuItem>
      <DropdownMenuItem>
        <Download /> Export JSON
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem className="text-destructive focus:text-destructive">
        <Trash2 /> Delete report
        <DropdownMenuShortcut>⌫</DropdownMenuShortcut>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarCheckboxItem,
} from "data-query-pro";

export const QueryMenubar = () => (
  <Menubar>
    <MenubarMenu>
      <MenubarTrigger>Query</MenubarTrigger>
    </MenubarMenu>
    <MenubarMenu defaultOpen>
      <MenubarTrigger>View</MenubarTrigger>
      <MenubarContent>
        <MenubarItem>
          Run query <MenubarShortcut>⌘↵</MenubarShortcut>
        </MenubarItem>
        <MenubarItem>
          Enhance with AI <MenubarShortcut>⌘E</MenubarShortcut>
        </MenubarItem>
        <MenubarSeparator />
        <MenubarCheckboxItem checked>Show as table</MenubarCheckboxItem>
        <MenubarCheckboxItem>Show as chart</MenubarCheckboxItem>
        <MenubarSeparator />
        <MenubarItem>
          Export results <MenubarShortcut>⌘⇧E</MenubarShortcut>
        </MenubarItem>
      </MenubarContent>
    </MenubarMenu>
    <MenubarMenu>
      <MenubarTrigger>Schema</MenubarTrigger>
    </MenubarMenu>
  </Menubar>
);

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  Button,
  Input,
  Label,
  Badge,
} from "data-query-pro";

export const ConnectionDetailsSheet = () => (
  <Sheet open>
    <SheetContent side="right" className="w-full sm:max-w-md">
      <SheetHeader>
        <SheetTitle>Connection details</SheetTitle>
        <SheetDescription>
          Edit how DataQuery Pro connects to your PostgreSQL database.
        </SheetDescription>
      </SheetHeader>
      <div className="mt-6 grid gap-4">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">PostgreSQL</Badge>
          <Badge variant="outline">Connected</Badge>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="host">Host</Label>
          <Input id="host" defaultValue="db.cloudmetrics.internal" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="port">Port</Label>
            <Input id="port" defaultValue="5432" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="db">Database</Label>
            <Input id="db" defaultValue="cloudmetrics" />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="user">Username</Label>
          <Input id="user" defaultValue="demo" />
        </div>
      </div>
      <SheetFooter className="mt-6">
        <Button variant="outline">Test connection</Button>
        <Button>Save changes</Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
);

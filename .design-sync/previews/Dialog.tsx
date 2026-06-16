import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Label,
} from "data-query-pro";

export const SaveReportDialog = () => (
  <Dialog open>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Save report</DialogTitle>
        <DialogDescription>
          Save this query to the cloudmetrics connection so you can run it again later.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-2">
        <div className="grid gap-2">
          <Label htmlFor="report-name">Report name</Label>
          <Input id="report-name" defaultValue="Monthly revenue by region" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="report-desc">Description</Label>
          <Input
            id="report-desc"
            defaultValue="Aggregates invoice totals grouped by billing region"
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline">Cancel</Button>
        <Button>Save report</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

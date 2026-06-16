import { Alert, AlertTitle, AlertDescription } from "data-query-pro";
import { Info, AlertTriangle } from "lucide-react";

export const SchemaInfoAlert = () => (
  <Alert className="w-[440px]">
    <Info className="h-4 w-4" />
    <AlertTitle>Schema uploaded</AlertTitle>
    <AlertDescription>
      The cloudmetrics schema is indexed in OpenAI. You can now generate
      natural-language queries against it.
    </AlertDescription>
  </Alert>
);

export const QueryFailedAlert = () => (
  <Alert variant="destructive" className="w-[440px]">
    <AlertTriangle className="h-4 w-4" />
    <AlertTitle>Query execution failed</AlertTitle>
    <AlertDescription>
      relation &quot;invoces&quot; does not exist. Check the table name or run
      auto-revise to correct the SQL.
    </AlertDescription>
  </Alert>
);

import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  Button,
} from "data-query-pro";
import { Upload } from "lucide-react";

export const UploadSchemaTooltip = () => (
  <TooltipProvider>
    <Tooltip open>
      <TooltipTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Upload schema">
          <Upload />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        Upload schema to OpenAI before generating queries
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

import { Progress } from "data-query-pro";

export const SchemaUploadProgress = () => (
  <div className="w-[440px] space-y-2">
    <div className="flex items-center justify-between text-sm">
      <span className="font-medium">Uploading schema to OpenAI</span>
      <span className="text-muted-foreground">68%</span>
    </div>
    <Progress value={68} />
    <p className="text-xs text-muted-foreground">
      Indexing 42 tables into the vector store…
    </p>
  </div>
);

export const IntrospectionProgress = () => (
  <div className="w-[440px] space-y-3">
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span>Introspecting tables</span>
        <span className="text-muted-foreground">100%</span>
      </div>
      <Progress value={100} />
    </div>
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span>Generating descriptions</span>
        <span className="text-muted-foreground">35%</span>
      </div>
      <Progress value={35} />
    </div>
  </div>
);

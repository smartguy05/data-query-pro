import { Toggle } from "data-query-pro";
import { Bold, Italic, Star, Eye } from "lucide-react";

export const Default = () => (
  <Toggle aria-label="Toggle favorite">
    <Star /> Favorite
  </Toggle>
);

export const Variants = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Toggle defaultPressed>
      <Eye /> Show hidden
    </Toggle>
    <Toggle variant="outline">
      <Star /> Pin report
    </Toggle>
  </div>
);

export const Sizes = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Toggle size="sm" aria-label="Bold"><Bold /></Toggle>
    <Toggle size="default" aria-label="Italic"><Italic /></Toggle>
    <Toggle size="lg" variant="outline" aria-label="Star"><Star /></Toggle>
  </div>
);

export const States = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Toggle>Off</Toggle>
    <Toggle defaultPressed>On</Toggle>
    <Toggle disabled>Disabled</Toggle>
  </div>
);

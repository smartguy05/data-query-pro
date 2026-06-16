import { Avatar, AvatarImage, AvatarFallback } from "data-query-pro";

export const UserAvatar = () => (
  <div className="flex items-center gap-3">
    <Avatar>
      <AvatarImage src="https://i.pravatar.cc/80" alt="Anthony James" />
      <AvatarFallback>AJ</AvatarFallback>
    </Avatar>
    <div className="text-sm leading-tight">
      <div className="font-medium">Anthony James</div>
      <div className="text-muted-foreground">anthonyjames@oneflight.net</div>
    </div>
  </div>
);

export const FallbackAvatar = () => (
  <Avatar>
    <AvatarFallback>DQ</AvatarFallback>
  </Avatar>
);

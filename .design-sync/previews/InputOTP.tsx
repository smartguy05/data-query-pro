import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "data-query-pro";

export const SignInOTP = () => (
  <div className="space-y-3">
    <p className="text-sm font-medium">Enter the 6-digit verification code</p>
    <InputOTP maxLength={6} value="4821">
      <InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
        <InputOTPSlot index={2} />
        <InputOTPSlot index={3} />
        <InputOTPSlot index={4} />
        <InputOTPSlot index={5} />
      </InputOTPGroup>
    </InputOTP>
    <p className="text-xs text-muted-foreground">
      Sent to anthonyjames@oneflight.net
    </p>
  </div>
);

"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface ApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (apiKey: string) => void;
  resetTime?: number;
}

/**
 * Dialog component that prompts users to enter their OpenAI API key
 * when they reach the demo rate limit
 */
export function ApiKeyDialog({
  open,
  onOpenChange,
  onSubmit,
  resetTime,
}: ApiKeyDialogProps) {
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    // Basic validation
    if (!apiKey.trim()) {
      setError("Please enter an API key");
      return;
    }

    // OpenAI API keys should start with "sk-"
    if (!apiKey.startsWith("sk-")) {
      setError("OpenAI API keys should start with 'sk-'");
      return;
    }

    // Clear error and submit
    setError(null);
    onSubmit(apiKey);
    setApiKey(""); // Clear input for security
  };

  const handleCancel = () => {
    setApiKey("");
    setError(null);
    onOpenChange(false);
  };

  const getResetTimeMessage = () => {
    if (!resetTime) return null;

    const now = Date.now();
    const timeUntilReset = resetTime - now;

    if (timeUntilReset <= 0) {
      return "Your rate limit should reset soon.";
    }

    const hours = Math.floor(timeUntilReset / (1000 * 60 * 60));
    const minutes = Math.floor((timeUntilReset % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `Your rate limit will reset in ${hours} hour${hours > 1 ? "s" : ""} and ${minutes} minute${minutes !== 1 ? "s" : ""}.`;
    }
    return `Your rate limit will reset in ${minutes} minute${minutes !== 1 ? "s" : ""}.`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Demo Limit Reached</DialogTitle>
          <DialogDescription>
            You've reached the free demo limit for AI-powered features. To continue, you can either:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Wait for your rate limit to reset ({getResetTimeMessage()})</li>
              <li>Enter your own OpenAI API key to continue immediately</li>
            </ul>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="api-key">OpenAI API Key</Label>
            <Input
              id="api-key"
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setError(null); // Clear error on change
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSubmit();
                }
              }}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Alert>
            <AlertDescription className="text-sm">
              <strong>Privacy Notice:</strong> Your API key is stored only in your browser's session
              storage and is never sent to our servers for storage. It's included in API requests
              to authenticate directly with OpenAI, bypassing the rate limit.
            </AlertDescription>
          </Alert>

          <div className="text-sm text-muted-foreground">
            Don't have an OpenAI API key?{" "}
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Get one here
            </a>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Save and Continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

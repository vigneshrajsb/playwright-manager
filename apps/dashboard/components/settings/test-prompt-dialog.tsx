"use client";

import { useEffect } from "react";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTestPrompt } from "@/hooks/queries/use-prompt-settings";

interface TestPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: string;
}

export function TestPromptDialog({
  open,
  onOpenChange,
  content,
}: TestPromptDialogProps) {
  const testMutation = useTestPrompt();

  useEffect(() => {
    if (open && content) {
      testMutation.mutate(content);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, content]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Test Prompt</DialogTitle>
          <DialogDescription>
            Testing your prompt against the most recent failed test
          </DialogDescription>
        </DialogHeader>

        {testMutation.isPending && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {testMutation.isError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {testMutation.error instanceof Error
                ? testMutation.error.message
                : "Failed to test prompt"}
            </AlertDescription>
          </Alert>
        )}

        {testMutation.isSuccess && testMutation.data && (
          <div className="max-h-[60vh] overflow-y-auto pr-2">
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="text-sm font-medium">Sample Test</h4>
                  <Badge variant="secondary">
                    {new Date(
                      testMutation.data.sampleTest.failedAt
                    ).toLocaleString()}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {testMutation.data.sampleTest.title}
                </p>
                <p className="text-xs text-muted-foreground font-mono">
                  {testMutation.data.sampleTest.filePath}
                </p>
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-medium mb-2">Rendered Prompt</h4>
                <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto whitespace-pre-wrap font-mono">
                  {testMutation.data.renderedPrompt}
                </pre>
              </div>

              <Separator />

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="text-sm font-medium">LLM Response</h4>
                  {testMutation.data.llmConfigured ? (
                    <Badge variant="default">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      OpenAI Connected
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      No API Key
                    </Badge>
                  )}
                </div>
                {testMutation.data.llmResponse ? (
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto whitespace-pre-wrap font-mono">
                    {testMutation.data.llmResponse}
                  </pre>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {testMutation.data.llmConfigured
                      ? "No response received from LLM"
                      : "Set OPENAI_API_KEY environment variable to enable LLM testing"}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

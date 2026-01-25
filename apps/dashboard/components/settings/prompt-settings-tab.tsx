"use client";

import { useState, useRef, useMemo } from "react";
import { AlertTriangle, Play, Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  usePromptSettings,
  useSavePrompt,
  useRestorePrompt,
} from "@/hooks/queries/use-prompt-settings";
import { TestPromptDialog } from "./test-prompt-dialog";

const TEMPLATE_VARIABLES = [
  { name: "testTitle", description: "Name of the test", required: true },
  { name: "filePath", description: "Test file path", required: true },
  { name: "errorMessage", description: "Error message from failure", required: true },
  { name: "stackTrace", description: "Stack trace (truncated)", required: false },
  { name: "recentHistory", description: "Last 10 run results", required: false },
  { name: "similarErrors", description: "Similar errors on other tests", required: false },
  { name: "heuristicScore", description: "Current confidence %", required: false },
  { name: "heuristicReasoning", description: "Heuristic explanation", required: false },
];

const REQUIRED_VARIABLES = TEMPLATE_VARIABLES.filter((v) => v.required).map(
  (v) => v.name
);

interface PromptEditorProps {
  initialContent: string;
  defaultContent: string;
  history: Array<{ id: string; version: number; createdAt: string; isActive: boolean }>;
}

function PromptEditor({ initialContent, defaultContent, history }: PromptEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveMutation = useSavePrompt();
  const restoreMutation = useRestorePrompt();

  const [content, setContent] = useState(initialContent);
  const [testDialogOpen, setTestDialogOpen] = useState(false);

  // Derive hasChanges from current content vs initial
  const hasChanges = useMemo(() => {
    return content !== initialContent;
  }, [content, initialContent]);

  // Find missing required variables
  const missingVariables = useMemo(() => {
    return REQUIRED_VARIABLES.filter((v) => !content.includes(`{{${v}}}`));
  }, [content]);

  const handleInsertVariable = (variable: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = `{{${variable}}}`;
    const newContent =
      content.substring(0, start) + text + content.substring(end);
    setContent(newContent);

    // Set cursor position after inserted text
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + text.length, start + text.length);
    }, 0);
  };

  const handleSave = () => {
    saveMutation.mutate(content);
  };

  const handleRestore = (versionId: string) => {
    restoreMutation.mutate(versionId);
  };

  const handleResetToDefault = () => {
    setContent(defaultContent);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Flakiness Analysis Prompt</CardTitle>
          <CardDescription>
            Customize the AI prompt used to analyze test failures and determine
            if they are flaky or real bugs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="font-mono text-sm min-h-[400px] resize-y"
            placeholder="Enter your custom prompt..."
          />

          <div className="space-y-2">
            <p className="text-sm font-medium">Available Variables</p>
            <p className="text-xs text-muted-foreground">
              Click to insert at cursor position
            </p>
            <div className="flex flex-wrap gap-2">
              {TEMPLATE_VARIABLES.map((variable) => (
                <Badge
                  key={variable.name}
                  variant={variable.required ? "default" : "secondary"}
                  className="cursor-pointer hover:bg-primary/80"
                  onClick={() => handleInsertVariable(variable.name)}
                  title={variable.description}
                >
                  {`{{${variable.name}}}`}
                </Badge>
              ))}
            </div>
          </div>

          {missingVariables.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Missing required variables:{" "}
                {missingVariables.map((v) => `{{${v}}}`).join(", ")}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between gap-4 pt-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setTestDialogOpen(true)}
                disabled={!content.trim()}
              >
                <Play className="mr-2 h-4 w-4" />
                Test Prompt
              </Button>
              <Button
                variant="ghost"
                onClick={handleResetToDefault}
                disabled={content === defaultContent}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset to Default
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {history.length > 0 && (
                <Select
                  onValueChange={handleRestore}
                  disabled={restoreMutation.isPending}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Version history" />
                  </SelectTrigger>
                  <SelectContent>
                    {history.map((version) => (
                      <SelectItem key={version.id} value={version.id}>
                        v{version.version}
                        {version.isActive && " (current)"}
                        {" - "}
                        {new Date(version.createdAt).toLocaleDateString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Button
                onClick={handleSave}
                disabled={saveMutation.isPending || !hasChanges}
              >
                <Save className="mr-2 h-4 w-4" />
                {saveMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <TestPromptDialog
        open={testDialogOpen}
        onOpenChange={setTestDialogOpen}
        content={content}
      />
    </>
  );
}

export function PromptSettingsTab() {
  const { data, isLoading } = usePromptSettings();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const initialContent = data.active?.content ?? data.default;

  // Use key to reset PromptEditor when data changes (e.g., after save or restore)
  return (
    <PromptEditor
      key={data.active?.id ?? "default"}
      initialContent={initialContent}
      defaultContent={data.default}
      history={data.history}
    />
  );
}

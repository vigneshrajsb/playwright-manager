"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChevronDown, Loader2, HelpCircle, GitBranch, Globe } from "lucide-react";
import { useUpdateSkipRule, type QuarantinedRule } from "@/hooks/queries";

interface EditRuleSheetProps {
  rule: QuarantinedRule | null;
  onClose: () => void;
}

export function EditRuleSheet({ rule, onClose }: EditRuleSheetProps) {
  const [reason, setReason] = useState("");
  const [branchPattern, setBranchPattern] = useState("");
  const [envPattern, setEnvPattern] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateMutation = useUpdateSkipRule();

  // Sync form state when rule changes
  useEffect(() => {
    if (rule) {
      setReason(rule.reason || "");
      setBranchPattern(rule.branchPattern || "");
      setEnvPattern(rule.envPattern || "");
      setShowAdvanced(!!(rule.branchPattern || rule.envPattern));
    }
  }, [rule]);

  // Reset state when sheet closes
  useEffect(() => {
    if (!rule) {
      setReason("");
      setBranchPattern("");
      setEnvPattern("");
      setShowAdvanced(false);
    }
  }, [rule]);

  const handleSave = async () => {
    if (!rule || !reason.trim()) return;

    updateMutation.mutate(
      {
        id: rule.id,
        reason: reason.trim(),
        branchPattern: branchPattern.trim() || null,
        envPattern: envPattern.trim() || null,
      },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  const handleClose = () => {
    if (!updateMutation.isPending) {
      onClose();
    }
  };

  const isGlobalRule = !branchPattern.trim() && !envPattern.trim();
  const hasChanges =
    rule &&
    (reason.trim() !== rule.reason ||
      (branchPattern.trim() || null) !== rule.branchPattern ||
      (envPattern.trim() || null) !== rule.envPattern);

  return (
    <Sheet open={!!rule} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent side="right" className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Edit Skip Rule</SheetTitle>
          <SheetDescription className="truncate text-xs">
            {rule?.test.testTitle}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4 px-4">
          {/* Reason (required) */}
          <div className="space-y-2">
            <label
              htmlFor="edit-reason"
              className="text-sm font-medium leading-none"
            >
              Reason *
            </label>
            <Input
              id="edit-reason"
              placeholder="Why is this test being disabled?"
              value={reason}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReason(e.target.value)}
              disabled={updateMutation.isPending}
            />
          </div>

          {/* Advanced Options Toggle */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-between"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            Conditional Skip (Advanced)
            <ChevronDown
              className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
            />
          </Button>

          {/* Advanced Options */}
          {showAdvanced && (
            <div className="space-y-4 rounded-md border p-4">
              {/* Branch Pattern */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-muted-foreground" />
                  <label
                    htmlFor="edit-branchPattern"
                    className="text-sm font-medium leading-none"
                  >
                    Branch Pattern
                  </label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[250px]">
                      <p>Glob pattern to match branch names.</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Examples: feature-*, release/*, main
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  id="edit-branchPattern"
                  placeholder="e.g., feature-*, release/*"
                  value={branchPattern}
                  onChange={(e) => setBranchPattern(e.target.value)}
                  disabled={updateMutation.isPending}
                />
              </div>

              {/* Environment Pattern */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <label
                    htmlFor="edit-envPattern"
                    className="text-sm font-medium leading-none"
                  >
                    Environment Pattern
                  </label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[250px]">
                      <p>Glob pattern to match baseURL hostname.</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Examples: *.staging.example.com, localhost
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  id="edit-envPattern"
                  placeholder="e.g., *.staging.example.com"
                  value={envPattern}
                  onChange={(e) => setEnvPattern(e.target.value)}
                  disabled={updateMutation.isPending}
                />
              </div>

              {/* Help text */}
              <p className="text-xs text-muted-foreground">
                {isGlobalRule
                  ? "No patterns set - this is a global skip rule."
                  : "Both patterns must match for the rule to apply."}
              </p>
            </div>
          )}
        </div>

        <SheetFooter className="mt-6 px-4">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={updateMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!reason.trim() || !hasChanges || updateMutation.isPending}
          >
            {updateMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Save Changes
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

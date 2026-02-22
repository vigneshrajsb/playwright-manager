"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChevronDown, Loader2, HelpCircle, GitBranch, Globe } from "lucide-react";
import { useUpdateSkipRule } from "@/hooks/queries";
import type { SkipRule } from "@/types";

interface EditRuleDialogProps {
  rule: SkipRule | null;
  testTitle?: string;
  onClose: () => void;
}

export function EditRuleDialog({ rule, testTitle, onClose }: EditRuleDialogProps) {
  const [reason, setReason] = useState("");
  const [branchPattern, setBranchPattern] = useState("");
  const [envPattern, setEnvPattern] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateMutation = useUpdateSkipRule();

  /* eslint-disable react-hooks/set-state-in-effect -- form state sync from prop */
  useEffect(() => {
    if (rule) {
      setReason(rule.reason || "");
      setBranchPattern(rule.branchPattern || "");
      setEnvPattern(rule.envPattern || "");
      setShowAdvanced(!!(rule.branchPattern || rule.envPattern));
    } else {
      setReason("");
      setBranchPattern("");
      setEnvPattern("");
      setShowAdvanced(false);
    }
  }, [rule]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
    <Dialog open={!!rule} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Skip Rule</DialogTitle>
          {testTitle && (
            <DialogDescription className="truncate text-xs">
              {testTitle}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4 py-2">
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

          {showAdvanced && (
            <div className="space-y-4 rounded-md border p-4">
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

              <p className="text-xs text-muted-foreground">
                {isGlobalRule
                  ? "No patterns set - this is a global skip rule."
                  : "Both patterns must match for the rule to apply."}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

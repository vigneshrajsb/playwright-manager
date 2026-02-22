"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChevronDown, Loader2, HelpCircle } from "lucide-react";

export interface QuarantineTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  testCount: number;
  loading?: boolean;
  onConfirm: (data: {
    reason: string;
    branchPattern?: string;
    envPattern?: string;
  }) => void | Promise<void>;
}

export function QuarantineTestDialog({
  open,
  onOpenChange,
  testCount,
  loading = false,
  onConfirm,
}: QuarantineTestDialogProps) {
  const [reason, setReason] = useState("");
  const [branchPattern, setBranchPattern] = useState("");
  const [envPattern, setEnvPattern] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleConfirm = async () => {
    if (!reason.trim()) return;
    await onConfirm({
      reason: reason.trim(),
      branchPattern: branchPattern.trim() || undefined,
      envPattern: envPattern.trim() || undefined,
    });
  };

  const handleClose = () => {
    if (!loading) {
      setReason("");
      setBranchPattern("");
      setEnvPattern("");
      setShowAdvanced(false);
      onOpenChange(false);
    }
  };

  const isGlobalRule = !branchPattern.trim() && !envPattern.trim();
  const plural = testCount === 1 ? "test" : "tests";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            Quarantine {testCount} {plural}
          </DialogTitle>
          <DialogDescription>
            {isGlobalRule
              ? `This will skip the ${plural} on all branches and environments.`
              : `This will skip the ${plural} only when conditions match.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label
              htmlFor="reason"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Reason *
            </label>
            <Input
              id="reason"
              placeholder="Why is this test being quarantined?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={loading}
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
                  <label
                    htmlFor="branchPattern"
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
                  id="branchPattern"
                  placeholder="e.g., feature-*, release/*"
                  value={branchPattern}
                  onChange={(e) => setBranchPattern(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="envPattern"
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
                  id="envPattern"
                  placeholder="e.g., *.staging.example.com"
                  value={envPattern}
                  onChange={(e) => setEnvPattern(e.target.value)}
                  disabled={loading}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                Leave both empty for a global skip rule. If both are set, both
                must match.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!reason.trim() || loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Quarantine
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

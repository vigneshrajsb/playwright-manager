"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ConfirmationDialog } from "@/components/dialogs";
import { Loader2, Trash2, GitBranch, Globe, Ban } from "lucide-react";
import { formatDate } from "@/lib/utils/format";
import { useSkipRules, useDeleteSkipRule } from "@/hooks/queries";
import type { SkipRule } from "@/types";

interface RulesSheetProps {
  testId: string | null;
  testTitle?: string;
  onClose: () => void;
  onRuleDeleted?: () => void;
}

export function RulesSheet({
  testId,
  testTitle,
  onClose,
}: RulesSheetProps) {
  const [confirmDeleteRule, setConfirmDeleteRule] = useState<SkipRule | null>(
    null
  );

  const { data, isLoading } = useSkipRules(testId);
  const deleteMutation = useDeleteSkipRule();

  const rules = data?.rules ?? [];

  const handleDeleteRule = (rule: SkipRule) => {
    if (!testId) return;
    deleteMutation.mutate(
      { testId, ruleId: rule.id },
      {
        onSuccess: () => {
          setConfirmDeleteRule(null);
        },
      }
    );
  };

  const getRuleTypeLabel = (rule: SkipRule) => {
    const isGlobal = !rule.branchPattern && !rule.envPattern;
    if (isGlobal) return "Global";
    if (rule.branchPattern && rule.envPattern) return "Branch + Environment";
    if (rule.branchPattern) return "Branch";
    if (rule.envPattern) return "Environment";
    return "Unknown";
  };

  const getRuleIcon = (rule: SkipRule) => {
    const isGlobal = !rule.branchPattern && !rule.envPattern;
    if (isGlobal) return Ban;
    if (rule.branchPattern && rule.envPattern) return GitBranch;
    if (rule.branchPattern) return GitBranch;
    if (rule.envPattern) return Globe;
    return Ban;
  };

  return (
    <>
      <Sheet open={!!testId} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <>
              <SheetHeader>
                <SheetTitle className="text-base">Skip Rules</SheetTitle>
                <SheetDescription className="truncate text-xs">
                  {testTitle || "Manage skip rules for this test"}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 space-y-4 px-4 pb-4">
                {rules.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      No skip rules configured
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      This test is enabled and will run normally
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rules.map((rule) => {
                      const Icon = getRuleIcon(rule);
                      const isDeleting =
                        deleteMutation.isPending &&
                        deleteMutation.variables?.ruleId === rule.id;

                      return (
                        <div
                          key={rule.id}
                          className="rounded-lg border p-3 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              <Badge variant="secondary" className="text-xs">
                                {getRuleTypeLabel(rule)}
                              </Badge>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => setConfirmDeleteRule(rule)}
                              disabled={isDeleting}
                            >
                              {isDeleting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>

                          <p className="text-sm">{rule.reason}</p>

                          {(rule.branchPattern || rule.envPattern) && (
                            <div className="space-y-1 text-xs text-muted-foreground">
                              {rule.branchPattern && (
                                <div className="flex items-center gap-1">
                                  <GitBranch className="h-3 w-3" />
                                  <span>Branch:</span>
                                  <code className="bg-muted px-1 rounded">
                                    {rule.branchPattern}
                                  </code>
                                </div>
                              )}
                              {rule.envPattern && (
                                <div className="flex items-center gap-1">
                                  <Globe className="h-3 w-3" />
                                  <span>Environment:</span>
                                  <code className="bg-muted px-1 rounded">
                                    {rule.envPattern}
                                  </code>
                                </div>
                              )}
                            </div>
                          )}

                          <Separator />

                          <p className="text-xs text-muted-foreground">
                            Created {formatDate(rule.createdAt)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmationDialog
        open={!!confirmDeleteRule}
        onOpenChange={(open) => !open && setConfirmDeleteRule(null)}
        title="Delete Skip Rule"
        description={
          <>
            Are you sure you want to delete this skip rule? The test will no
            longer be skipped based on this rule.
            {confirmDeleteRule && (
              <span className="block mt-2 font-medium text-foreground">
                &quot;{confirmDeleteRule.reason}&quot;
              </span>
            )}
          </>
        }
        confirmText="Delete"
        confirmVariant="destructive"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (confirmDeleteRule) {
            handleDeleteRule(confirmDeleteRule);
          }
        }}
      />
    </>
  );
}

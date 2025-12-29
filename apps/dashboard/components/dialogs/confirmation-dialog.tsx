"use client";

import { ReactNode, useState } from "react";
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
import { Loader2 } from "lucide-react";

export interface ConfirmationDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Dialog title */
  title: string;
  /** Dialog description/message */
  description: ReactNode;
  /** Confirm button text */
  confirmText?: string;
  /** Cancel button text */
  cancelText?: string;
  /** Confirm button variant */
  confirmVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  /** Whether the action is loading */
  loading?: boolean;
  /** Callback when confirmed */
  onConfirm: () => void | Promise<void>;
  /** Optional: Require a reason input */
  requireReason?: boolean;
  /** Placeholder text for reason input */
  reasonPlaceholder?: string;
  /** Callback with reason when confirmed (only when requireReason is true) */
  onConfirmWithReason?: (reason: string) => void | Promise<void>;
}

/**
 * Reusable confirmation dialog component
 *
 * @example
 * ```tsx
 * // Simple confirmation
 * <ConfirmationDialog
 *   open={deleteOpen}
 *   onOpenChange={setDeleteOpen}
 *   title="Delete Test"
 *   description="Are you sure you want to delete this test?"
 *   confirmText="Delete"
 *   confirmVariant="destructive"
 *   onConfirm={handleDelete}
 * />
 *
 * // With required reason
 * <ConfirmationDialog
 *   open={disableOpen}
 *   onOpenChange={setDisableOpen}
 *   title="Disable Test"
 *   description="This test will be skipped during runs."
 *   requireReason
 *   reasonPlaceholder="Reason for disabling (required)"
 *   onConfirmWithReason={handleDisableWithReason}
 * />
 * ```
 */
export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmVariant = "default",
  loading = false,
  onConfirm,
  requireReason = false,
  reasonPlaceholder = "Reason (required)",
  onConfirmWithReason,
}: ConfirmationDialogProps) {
  const [reason, setReason] = useState("");

  const handleConfirm = async () => {
    if (requireReason && onConfirmWithReason) {
      if (!reason.trim()) return;
      await onConfirmWithReason(reason);
    } else {
      await onConfirm();
    }
  };

  const handleClose = () => {
    if (!loading) {
      setReason("");
      onOpenChange(false);
    }
  };

  const isConfirmDisabled = loading || (requireReason && !reason.trim());

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild>
            <div>{description}</div>
          </DialogDescription>
        </DialogHeader>

        {requireReason && (
          <div className="py-4">
            <Input
              placeholder={reasonPlaceholder}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={loading}
            />
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={loading}
          >
            {cancelText}
          </Button>
          <Button
            variant={confirmVariant}
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface BulkConfirmationDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Number of items being affected */
  count: number;
  /** Item type name (e.g., "test", "result") */
  itemType?: string;
  /** Action being performed (e.g., "delete", "disable") */
  action: string;
  /** Dialog description */
  description?: ReactNode;
  /** Whether the action is loading */
  loading?: boolean;
  /** Callback when confirmed */
  onConfirm: () => void | Promise<void>;
  /** Confirm button variant */
  confirmVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  /** Optional: Require a reason input */
  requireReason?: boolean;
  /** Placeholder text for reason input */
  reasonPlaceholder?: string;
  /** Callback with reason when confirmed */
  onConfirmWithReason?: (reason: string) => void | Promise<void>;
}

/**
 * Confirmation dialog for bulk actions
 *
 * @example
 * ```tsx
 * <BulkConfirmationDialog
 *   open={bulkDeleteOpen}
 *   onOpenChange={setBulkDeleteOpen}
 *   count={selectedIds.size}
 *   action="delete"
 *   confirmVariant="destructive"
 *   requireReason
 *   onConfirmWithReason={handleBulkDelete}
 * />
 * ```
 */
export function BulkConfirmationDialog({
  open,
  onOpenChange,
  count,
  itemType = "test",
  action,
  description,
  loading = false,
  onConfirm,
  confirmVariant = "default",
  requireReason = false,
  reasonPlaceholder,
  onConfirmWithReason,
}: BulkConfirmationDialogProps) {
  const plural = count === 1 ? itemType : `${itemType}s`;
  const title = `${action.charAt(0).toUpperCase() + action.slice(1)} ${count} ${plural}`;
  const defaultDescription = description || `Are you sure you want to ${action} ${count} ${plural}?`;
  const defaultReasonPlaceholder = reasonPlaceholder || `Reason for ${action}ing (required)`;
  const confirmText = `${action.charAt(0).toUpperCase() + action.slice(1)} ${plural}`;

  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={defaultDescription}
      confirmText={confirmText}
      confirmVariant={confirmVariant}
      loading={loading}
      onConfirm={onConfirm}
      requireReason={requireReason}
      reasonPlaceholder={defaultReasonPlaceholder}
      onConfirmWithReason={onConfirmWithReason}
    />
  );
}

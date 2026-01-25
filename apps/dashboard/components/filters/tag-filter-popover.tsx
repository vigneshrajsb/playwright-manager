"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronDown } from "lucide-react";

export interface TagFilterPopoverProps {
  /** Available tags to choose from */
  tags: string[];
  /** Currently selected tags */
  selectedTags: string[];
  /** Callback when tags selection changes */
  onTagsChange: (tags: string[]) => void;
  /** Placeholder text when no tags selected */
  placeholder?: string;
  /** Popover alignment */
  align?: "start" | "center" | "end";
  /** Button width class */
  buttonClassName?: string;
}

/**
 * Popover component for multi-select tag filtering
 *
 * @example
 * ```tsx
 * const [selectedTags, setSelectedTags] = useState<string[]>([]);
 *
 * <TagFilterPopover
 *   tags={["@smoke", "@regression", "@e2e"]}
 *   selectedTags={selectedTags}
 *   onTagsChange={setSelectedTags}
 * />
 * ```
 */
export function TagFilterPopover({
  tags,
  selectedTags,
  onTagsChange,
  placeholder = "Tags",
  align = "start",
  buttonClassName = "w-[130px]",
}: TagFilterPopoverProps) {
  const [open, setOpen] = useState(false);

  const toggleTag = (tag: string) => {
    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag];
    onTagsChange(newTags);
  };

  const clearTags = () => {
    onTagsChange([]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`${buttonClassName} justify-between`}
        >
          {selectedTags.length > 0 ? (
            <span className="truncate">
              {selectedTags.length} tag{selectedTags.length > 1 ? "s" : ""}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align={align}>
        <div className="p-2 border-b">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Filter by tags</span>
            {selectedTags.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-1 text-xs"
                onClick={clearTags}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
        <div className="max-h-[200px] overflow-y-auto p-2">
          {tags.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2 text-center">
              No tags found
            </p>
          ) : (
            tags.map((tag) => (
              <div
                key={tag}
                className="flex items-center space-x-2 py-1.5 px-1 hover:bg-muted rounded cursor-pointer"
                onClick={() => toggleTag(tag)}
              >
                <Checkbox
                  checked={selectedTags.includes(tag)}
                  onCheckedChange={() => toggleTag(tag)}
                />
                <span className="text-sm">{tag}</span>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

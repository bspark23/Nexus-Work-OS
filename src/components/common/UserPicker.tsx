import { useState } from "react";
import { Check, ChevronsUpDown, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types";

export function UserPicker({
  people,
  value,
  onChange,
  placeholder = "Select a person",
  compact = false,
}: {
  people: Profile[];
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
  /** Compact mode for use inside table cells */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = people.find((p) => p.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            compact ? "h-7 text-xs border-0 bg-transparent px-1.5" : ""
          )}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <UserRound className={cn("text-muted-foreground shrink-0", compact ? "size-3" : "size-4")} />
            <span className="truncate">{selected ? selected.full_name : placeholder}</span>
          </span>
          <ChevronsUpDown className={cn("shrink-0 opacity-50", compact ? "size-3" : "size-4")} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search people…" />
          <CommandList>
            <CommandEmpty>No one found.</CommandEmpty>
            <CommandGroup>
              {people.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.full_name} ${p.username}`}
                  onSelect={() => {
                    onChange(p.id === value ? null : p.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("size-4", value === p.id ? "opacity-100" : "opacity-0")}
                  />
                  <span className="flex-1 truncate">{p.full_name}</span>
                  <span className="text-muted-foreground text-xs">@{p.username}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

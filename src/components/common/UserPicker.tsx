import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { initials } from "@/lib/format";
import type { Profile } from "@/lib/types";

function PersonAvatar({
  person,
  size = "sm",
}: {
  person: Profile;
  size?: "sm" | "xs";
}) {
  const dim = size === "xs" ? "size-5" : "size-6";
  const text = size === "xs" ? "text-[9px]" : "text-[10px]";
  return (
    <Avatar className={cn(dim, "shrink-0")}>
      <AvatarImage src={person.avatar_url ?? undefined} className="object-cover" />
      <AvatarFallback className={cn("bg-primary/15 text-primary font-semibold", text)}>
        {initials(person.full_name)}
      </AvatarFallback>
    </Avatar>
  );
}

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
            compact ? "h-7 text-xs border-0 bg-transparent px-1.5" : "",
          )}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            {selected ? (
              <PersonAvatar person={selected} size={compact ? "xs" : "sm"} />
            ) : (
              <Avatar className={cn("shrink-0", compact ? "size-5" : "size-6")}>
                <AvatarFallback className="bg-muted text-muted-foreground text-[9px]">?</AvatarFallback>
              </Avatar>
            )}
            <span className="truncate">
              {selected ? selected.full_name : placeholder}
            </span>
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
                    className={cn("size-4 shrink-0", value === p.id ? "opacity-100" : "opacity-0")}
                  />
                  <PersonAvatar person={p} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{p.full_name}</p>
                    <p className="text-muted-foreground text-xs truncate">@{p.username}</p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

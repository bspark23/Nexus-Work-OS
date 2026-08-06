import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications } from "@/hooks/useData";
import { markNotificationRead } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const { data: notifications = [], refetch } = useNotifications();
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="size-4.5" />
          {unread > 0 ? (
            <span className="bg-destructive text-destructive-foreground absolute top-1 right-1 flex size-4 items-center justify-center rounded-full text-[9px] font-bold">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={async () => {
                await Promise.all(
                  notifications.filter((n) => !n.read).map((n) => markNotificationRead(n.id)),
                );
                refetch();
              }}
            >
              Mark all read
            </Button>
          ) : null}
        </div>
        <ScrollArea className="max-h-[380px]">
          {notifications.length === 0 ? (
            <p className="text-muted-foreground px-4 py-10 text-center text-xs">
              You're all caught up.
            </p>
          ) : (
            <ul className="divide-y">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    "hover:bg-secondary/60 transition-smooth cursor-pointer px-4 py-3",
                    !n.read && "bg-primary/5",
                  )}
                  onClick={async () => {
                    if (!n.read) {
                      await markNotificationRead(n.id);
                      refetch();
                    }
                  }}
                >
                  <div className="flex items-start gap-2">
                    {!n.read ? <span className="bg-primary mt-1.5 size-1.5 rounded-full" /> : null}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{n.title}</p>
                      {n.body ? (
                        <p className="text-muted-foreground line-clamp-2 text-xs">{n.body}</p>
                      ) : null}
                      <p className="text-muted-foreground mt-1 text-[10px]">
                        {relativeTime(n.created_at)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

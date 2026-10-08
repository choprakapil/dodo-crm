"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell } from "lucide-react";
import { getUnreadNotificationCount } from "@/lib/actions/notification-actions";
import { NotificationDrawer } from "./notification-drawer";

interface NotificationBellProps {
  className?: string;
}

export function NotificationBell({ className = "" }: NotificationBellProps) {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const fetchUnreadCount = useCallback(async () => {
    // Only poll when the tab is visible to conserve client & server resources
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }

    try {
      const res = await getUnreadNotificationCount();
      if (res.success && typeof res.count === "number") {
        setUnreadCount(res.count);
      }
    } catch {
      // Quiet fail on network hiccups
    }
  }, []);

  useEffect(() => {
    // Immediate initial fetch
    fetchUnreadCount();

    // 30-second polling as specified in 06-DODO-V2-NOTIFICATION-ARCHITECTURE.md
    const interval = setInterval(fetchUnreadCount, 30_000);

    // Revalidate immediately when tab gains focus
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchUnreadCount();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchUnreadCount]);

  return (
    <>
      <button
        onClick={() => setIsDrawerOpen(true)}
        className={`relative inline-flex items-center justify-center p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50 ${className}`}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold text-white bg-indigo-600 rounded-full border-2 border-white shadow-xs animate-in zoom-in-50 duration-150">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      <NotificationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onNotificationsChanged={fetchUnreadCount}
      />
    </>
  );
}

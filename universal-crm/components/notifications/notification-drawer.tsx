"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  CheckCheck,
  Bell,
  Clock,
  UserCheck,
  AtSign,
  TrendingUp,
  MessageSquare,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  NotificationItem,
} from "@/lib/actions/notification-actions";

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNotificationsChanged: () => void;
}

function formatTimeAgo(date: Date | string): string {
  const d = new Date(date);
  const diff = Math.floor((new Date().getTime() - d.getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function getNotificationIcon(type: string) {
  switch (type) {
    case "ASSIGNMENT":
      return <UserCheck className="w-4 h-4 text-indigo-600" />;
    case "MENTION":
      return <AtSign className="w-4 h-4 text-violet-600" />;
    case "COMMENT":
      return <MessageSquare className="w-4 h-4 text-sky-600" />;
    case "TASK_DUE":
    case "TASK_OVERDUE":
      return <Clock className="w-4 h-4 text-amber-600" />;
    case "DEAL_STAGE":
      return <TrendingUp className="w-4 h-4 text-emerald-600" />;
    default:
      return <Bell className="w-4 h-4 text-slate-500" />;
  }
}

export function NotificationDrawer({
  isOpen,
  onClose,
  onNotificationsChanged,
}: NotificationDrawerProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getNotifications(40);
      if (res.success && res.data) {
        setNotifications(res.data);
      } else {
        setError(res.error || "Failed to load notifications");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen, loadNotifications]);

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt || new Date() }))
      );
      onNotificationsChanged();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleNotificationClick(item: NotificationItem) {
    try {
      if (!item.readAt) {
        await markNotificationAsRead(item.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, readAt: new Date() } : n))
        );
        onNotificationsChanged();
      }
    } catch (err) {
      console.error(err);
    }

    onClose();
    if (item.deepLink) {
      router.push(item.deepLink);
    }
  }

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/30 backdrop-blur-2xs flex justify-end animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-white border-l border-slate-200 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-label="Notification Center"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200 bg-white sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-indigo-600" />
            <h2 className="font-semibold text-slate-900 text-sm">Notifications</h2>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] font-mono rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                {unreadCount} new
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-slate-500 hover:text-indigo-600 flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-100 transition"
                title="Mark all as read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition"
              aria-label="Close notifications"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2">
          {loading && notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
              <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-500">Loading notifications...</p>
            </div>
          ) : error ? (
            <div className="p-3 text-rose-700 text-xs flex items-center gap-2 bg-rose-50 rounded-md m-2 border border-rose-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-4">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2.5">
                <Bell className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-slate-800">All caught up</p>
              <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
                No new notifications. Alerts for mentions, assignments, and follow-ups will appear here.
              </p>
            </div>
          ) : (
            notifications.map((item) => {
              const isUnread = !item.readAt;
              return (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`p-3 rounded-lg cursor-pointer transition flex items-start gap-3 my-0.5 ${
                    isUnread
                      ? "bg-indigo-50/50 hover:bg-indigo-50/80 border-l-2 border-indigo-600"
                      : "hover:bg-slate-50 opacity-85"
                  }`}
                >
                  <div className="mt-0.5 p-1.5 rounded-md bg-white border border-slate-200 shadow-2xs shrink-0">
                    {getNotificationIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs truncate ${isUnread ? "text-slate-900 font-semibold" : "text-slate-700 font-medium"}`}>
                        {item.title}
                      </p>
                      <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                        {formatTimeAgo(item.createdAt)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2 leading-relaxed">
                      {item.message}
                    </p>
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-700 font-medium">
                      <span>View record</span>
                      <ExternalLink className="w-3 h-3" />
                    </div>
                  </div>
                  {isUnread && (
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0 mt-1.5" />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="p-2.5 border-t border-slate-200 bg-slate-50/80 text-center">
          <p className="text-[11px] text-slate-500 font-mono">
            Auto-refreshes every 30s • Scoped to your tenant
          </p>
        </div>
      </div>
    </div>
  );
}

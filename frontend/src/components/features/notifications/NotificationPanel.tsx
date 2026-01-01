'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Bell,
  X,
  Check,
  CheckCheck,
  Trash2,
  Info,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotificationStore, type Notification } from '@/stores';
import { Button } from '@/components/ui';

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const iconMap = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertCircle,
};

const colorMap = {
  info: 'text-blue-400 bg-blue-500/10',
  success: 'text-green-400 bg-green-500/10',
  warning: 'text-yellow-400 bg-yellow-500/10',
  error: 'text-red-400 bg-red-500/10',
};

function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

function NotificationItem({
  notification,
  onMarkAsRead,
  onRemove,
}: {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const Icon = iconMap[notification.type];

  const content = (
    <div
      className={cn(
        'relative flex gap-3 p-3 rounded-lg transition-colors',
        notification.read ? 'bg-transparent' : 'bg-surface-hover',
        notification.action?.href && 'hover:bg-surface-hover cursor-pointer'
      )}
      onClick={() => {
        if (!notification.read) onMarkAsRead(notification.id);
        notification.action?.onClick?.();
      }}
    >
      <div className={cn('flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center', colorMap[notification.type])}>
        <Icon className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className={cn('text-sm font-medium', notification.read ? 'text-text-secondary' : 'text-text-primary')}>
            {notification.title}
          </h4>
          <span className="text-xs text-text-muted whitespace-nowrap">{formatTime(notification.timestamp)}</span>
        </div>
        <p className={cn('text-sm mt-0.5', notification.read ? 'text-text-muted' : 'text-text-secondary')}>
          {notification.message}
        </p>
        {notification.action && (
          <span className="inline-block mt-1.5 text-xs font-medium text-primary hover:text-primary-hover">
            {notification.action.label}
          </span>
        )}
      </div>

      {!notification.read && (
        <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-primary" />
      )}

      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemove(notification.id);
        }}
        className="flex-shrink-0 p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors opacity-0 group-hover:opacity-100"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );

  if (notification.action?.href) {
    return (
      <Link href={notification.action.href} className="block group">
        {content}
      </Link>
    );
  }

  return <div className="group">{content}</div>;
}

export function NotificationPanel({ isOpen, onClose }: NotificationPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification, clearAll } =
    useNotificationStore();

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Close on escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className="absolute top-full right-0 mt-2 w-96 max-h-[70vh] bg-surface border border-border rounded-xl shadow-xl overflow-hidden z-50"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-text-primary" />
          <h3 className="font-semibold text-text-primary">Notifications</h3>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-primary text-white rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
              title="Mark all as read"
            >
              <CheckCheck className="w-4 h-4" />
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={clearAll}
              className="p-1.5 rounded text-text-muted hover:text-red-400 hover:bg-surface-hover transition-colors"
              title="Clear all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notifications list */}
      <div className="overflow-y-auto max-h-[calc(70vh-60px)]">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-16 h-16 rounded-full bg-surface-hover flex items-center justify-center mb-4">
              <Bell className="w-8 h-8 text-text-muted" />
            </div>
            <p className="text-text-secondary text-center">No notifications yet</p>
            <p className="text-text-muted text-sm text-center mt-1">
              You'll be notified about recordings, updates, and more
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={markAsRead}
                onRemove={removeNotification}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

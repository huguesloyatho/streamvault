'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Bell, Radio, Film, Calendar, AlertCircle, Trash2 } from 'lucide-react';
import { Card, Button } from '@/components/ui';
import { useNotificationStore } from '@/stores';

interface NotificationSetting {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  enabled: boolean;
}

export default function NotificationsSettingsPage() {
  const { notifications, clearAll, unreadCount } = useNotificationStore();

  const [settings, setSettings] = useState<NotificationSetting[]>([
    {
      id: 'recordings',
      label: 'Recording notifications',
      description: 'Get notified when recordings start, stop, or fail',
      icon: Radio,
      enabled: true,
    },
    {
      id: 'playback',
      label: 'Playback alerts',
      description: 'Alerts for stream errors or quality changes',
      icon: Film,
      enabled: true,
    },
    {
      id: 'scheduled',
      label: 'Scheduled recordings',
      description: 'Reminders before scheduled recordings start',
      icon: Calendar,
      enabled: true,
    },
    {
      id: 'system',
      label: 'System notifications',
      description: 'Updates, maintenance, and important announcements',
      icon: AlertCircle,
      enabled: true,
    },
  ]);

  const toggleSetting = (id: string) => {
    setSettings((prev) =>
      prev.map((setting) =>
        setting.id === id ? { ...setting, enabled: !setting.enabled } : setting
      )
    );
  };

  const handleClearAll = () => {
    if (confirm('Are you sure you want to clear all notifications?')) {
      clearAll();
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/settings"
          className="p-2 rounded-lg hover:bg-surface-hover transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-text-secondary" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Notifications</h1>
          <p className="text-sm text-text-secondary">Configure notification preferences</p>
        </div>
      </div>

      {/* Stats */}
      <Card variant="bordered" padding="md" className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-text-secondary">Total notifications</p>
              <p className="text-xl font-semibold text-text-primary">{notifications.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-text-secondary">Unread</p>
              <p className="text-xl font-semibold text-primary">{unreadCount}</p>
            </div>
            {notifications.length > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleClearAll}
                leftIcon={<Trash2 className="w-4 h-4" />}
              >
                Clear all
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Notification Settings */}
      <h2 className="text-lg font-semibold text-text-primary mb-4">Notification Types</h2>
      <div className="space-y-3">
        {settings.map((setting) => (
          <Card key={setting.id} variant="bordered" padding="md">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-surface-hover flex items-center justify-center flex-shrink-0">
                <setting.icon className="w-5 h-5 text-text-secondary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-medium text-text-primary">{setting.label}</h3>
                <p className="text-sm text-text-secondary">{setting.description}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={setting.enabled}
                  onChange={() => toggleSetting(setting.id)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-surface-hover peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </Card>
        ))}
      </div>

      {/* Browser Notifications */}
      <h2 className="text-lg font-semibold text-text-primary mt-8 mb-4">Browser Notifications</h2>
      <Card variant="bordered" padding="md">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-medium text-text-primary">Push notifications</h3>
            <p className="text-sm text-text-secondary">
              Receive notifications even when the app is in background
            </p>
          </div>
          <Button variant="secondary" size="sm">
            Enable
          </Button>
        </div>
      </Card>
    </div>
  );
}

'use client';

import Link from 'next/link';
import {
  List,
  Shield,
  User,
  Bell,
  Palette,
  HelpCircle,
  Calendar,
  ChevronRight,
  Subtitles,
} from 'lucide-react';
import { Card } from '@/components/ui';

interface SettingsLink {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  disabled?: boolean;
}

const settingsLinks: SettingsLink[] = [
  {
    title: 'Playlists',
    description: 'Manage your M3U playlists and channel sources',
    href: '/settings/playlists',
    icon: List,
  },
  {
    title: 'EPG Sources',
    description: 'Manage TV program guide data sources',
    href: '/settings/epg',
    icon: Calendar,
  },
  {
    title: 'Subtitles',
    description: 'Configure automatic subtitle generation and translation',
    href: '/settings/subtitles',
    icon: Subtitles,
  },
  {
    title: 'Account',
    description: 'Update your profile and account settings',
    href: '/settings/account',
    icon: User,
  },
  {
    title: 'Security',
    description: 'Manage two-factor authentication and security',
    href: '/settings/security',
    icon: Shield,
  },
  {
    title: 'Notifications',
    description: 'Configure notification preferences',
    href: '/settings/notifications',
    icon: Bell,
  },
  {
    title: 'Appearance',
    description: 'Customize the app appearance',
    href: '/settings/appearance',
    icon: Palette,
  },
  {
    title: 'Help & Support',
    description: 'Get help and contact support',
    href: '/settings/help',
    icon: HelpCircle,
  },
];

export default function SettingsPage() {
  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-text-primary mb-6">Settings</h1>

      <div className="space-y-3">
        {settingsLinks.map((link) => (
          <Link
            key={link.href}
            href={link.disabled ? '#' : link.href}
            className={link.disabled ? 'pointer-events-none' : ''}
          >
            <Card
              variant="bordered"
              padding="md"
              hover={!link.disabled}
              className={`flex items-center gap-4 ${
                link.disabled ? 'opacity-50' : ''
              }`}
            >
              <div className="w-10 h-10 rounded-lg bg-surface-hover flex items-center justify-center flex-shrink-0">
                <link.icon className="w-5 h-5 text-text-secondary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-medium text-text-primary">
                  {link.title}
                  {link.disabled && (
                    <span className="ml-2 text-xs text-text-muted">(Coming soon)</span>
                  )}
                </h3>
                <p className="text-sm text-text-secondary truncate">
                  {link.description}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-text-muted flex-shrink-0" />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

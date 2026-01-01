'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Tv,
  Heart,
  History,
  Calendar,
  Video,
  Settings,
  Search,
  Users,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui';
import { useAuthStore, useProfileStore } from '@/stores';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
}

const mainNavItems: NavItem[] = [
  { label: 'Home', href: '/home', icon: <Home className="w-5 h-5" /> },
  { label: 'Browse', href: '/browse', icon: <Tv className="w-5 h-5" /> },
  { label: 'Search', href: '/search', icon: <Search className="w-5 h-5" /> },
];

const libraryItems: NavItem[] = [
  { label: 'Favorites', href: '/favorites', icon: <Heart className="w-5 h-5" /> },
  { label: 'History', href: '/history', icon: <History className="w-5 h-5" /> },
  { label: 'Guide', href: '/guide', icon: <Calendar className="w-5 h-5" /> },
  { label: 'Recordings', href: '/recordings', icon: <Video className="w-5 h-5" /> },
];

const settingsItems: NavItem[] = [
  { label: 'Profiles', href: '/profiles', icon: <Users className="w-5 h-5" /> },
  { label: 'Settings', href: '/settings', icon: <Settings className="w-5 h-5" /> },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const { activeProfile } = useProfileStore();

  const handleLogout = () => {
    logout();
  };

  const NavLink = ({ item }: { item: NavItem }) => {
    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

    return (
      <Link
        href={item.href}
        className={cn(
          'sidebar-item group',
          isActive && 'active'
        )}
        onClick={() => setIsMobileOpen(false)}
      >
        <span className={cn(
          'flex-shrink-0 transition-colors',
          isActive ? 'text-primary' : 'text-text-secondary group-hover:text-text-primary'
        )}>
          {item.icon}
        </span>
        {!isCollapsed && (
          <span className="flex-1 truncate">{item.label}</span>
        )}
        {!isCollapsed && item.badge && (
          <span className="px-2 py-0.5 text-xs font-medium bg-primary/20 text-primary rounded-full">
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className={cn(
        'flex items-center gap-3 px-4 py-6',
        isCollapsed && 'justify-center'
      )}>
        <div className="w-8 h-8 flex-shrink-0">
          <svg viewBox="0 0 32 32" className="w-full h-full">
            <defs>
              <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8B5CF6" />
                <stop offset="100%" stopColor="#6366F1" />
              </linearGradient>
            </defs>
            <rect x="2" y="2" width="28" height="28" rx="6" fill="url(#logoGrad)" />
            <path d="M12 9 L12 23 L24 16 Z" fill="white" />
          </svg>
        </div>
        {!isCollapsed && (
          <span className="text-xl font-bold text-text-primary">StreamVault</span>
        )}
      </div>

      {/* Profile */}
      <div className={cn(
        'px-4 py-3 mb-4',
        isCollapsed && 'px-2'
      )}>
        <Link
          href="/profiles"
          className={cn(
            'flex items-center gap-3 p-2 rounded-lg bg-surface hover:bg-surface-hover transition-colors',
            isCollapsed && 'justify-center'
          )}
        >
          <Avatar
            src={activeProfile?.avatar}
            name={activeProfile?.name || user?.username}
            size="sm"
          />
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">
                {activeProfile?.name || user?.username || 'Guest'}
              </p>
              <p className="text-xs text-text-muted truncate">
                {activeProfile?.is_kids ? 'Kids Profile' : 'Switch Profile'}
              </p>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 space-y-1 overflow-y-auto">
        {/* Main */}
        <div className="space-y-1">
          {mainNavItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </div>

        {/* Library */}
        <div className="pt-4 mt-4 border-t border-border">
          {!isCollapsed && (
            <p className="px-4 mb-2 text-xs font-semibold text-text-muted uppercase tracking-wider">
              Library
            </p>
          )}
          <div className="space-y-1">
            {libraryItems.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </div>
        </div>

        {/* Settings */}
        <div className="pt-4 mt-4 border-t border-border">
          {!isCollapsed && (
            <p className="px-4 mb-2 text-xs font-semibold text-text-muted uppercase tracking-wider">
              Account
            </p>
          )}
          <div className="space-y-1">
            {settingsItems.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-border">
        <button
          onClick={handleLogout}
          className="sidebar-item w-full text-error hover:bg-error/10"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!isCollapsed && <span>Sign Out</span>}
        </button>

        {/* Collapse toggle - desktop only */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden lg:flex sidebar-item w-full mt-1"
        >
          {isCollapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5 flex-shrink-0" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="fixed top-4 left-4 z-50 lg:hidden p-2 rounded-lg bg-surface hover:bg-surface-hover transition-colors"
      >
        <Menu className="w-6 h-6 text-text-primary" />
      </button>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full bg-background-secondary flex flex-col',
          'transition-all duration-300 ease-in-out',
          // Mobile
          'lg:relative lg:translate-x-0',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full',
          // Width
          isCollapsed ? 'w-[72px]' : 'w-[240px]'
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}

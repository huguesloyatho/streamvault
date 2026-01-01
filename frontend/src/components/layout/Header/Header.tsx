'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Bell, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, Dropdown } from '@/components/ui';
import { useAuthStore, useProfileStore, useChannelStore, useNotificationStore } from '@/stores';
import { NotificationPanel } from '@/components/features/notifications';

export function Header() {
  const router = useRouter();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { user, logout } = useAuthStore();
  const { activeProfile } = useProfileStore();
  const { setSearchQuery } = useChannelStore();
  const { unreadCount } = useNotificationStore();

  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) {
      setSearchQuery(searchValue);
      router.push(`/search?q=${encodeURIComponent(searchValue)}`);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
  };

  const closeSearch = () => {
    setIsSearchOpen(false);
    setSearchValue('');
    setSearchQuery('');
  };

  const userMenuItems = [
    { label: 'Switch Profile', value: 'profiles', icon: undefined },
    { label: 'Account', value: 'account', icon: undefined },
    { label: 'Settings', value: 'settings', icon: undefined },
    { label: 'Sign Out', value: 'logout', icon: undefined, danger: true },
  ];

  const handleMenuSelect = (value: string) => {
    switch (value) {
      case 'profiles':
        router.push('/profiles');
        break;
      case 'account':
        router.push('/settings/account');
        break;
      case 'settings':
        router.push('/settings');
        break;
      case 'logout':
        logout();
        router.push('/login');
        break;
    }
  };

  return (
    <header className="sticky top-0 z-30 h-header bg-gradient-to-b from-background-primary/90 to-transparent backdrop-blur-sm">
      <div className="flex items-center justify-between h-full px-4 lg:px-6">
        {/* Left spacer for mobile menu button */}
        <div className="w-12 lg:w-0" />

        {/* Search */}
        <div className="flex-1 flex justify-center">
          <div
            className={cn(
              'relative transition-all duration-300',
              isSearchOpen ? 'w-full max-w-xl' : 'w-10'
            )}
          >
            {isSearchOpen ? (
              <form onSubmit={handleSearch} className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchValue}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search channels, movies, series..."
                  className="w-full h-10 pl-10 pr-10 bg-surface border border-border rounded-full
                             text-text-primary placeholder:text-text-muted
                             focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                <button
                  type="button"
                  onClick={closeSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                >
                  <X className="w-5 h-5" />
                </button>
              </form>
            ) : (
              <button
                onClick={() => setIsSearchOpen(true)}
                className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-surface-hover transition-colors"
              >
                <Search className="w-5 h-5 text-text-secondary" />
              </button>
            )}
          </div>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-4">
          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className={cn(
                'relative flex items-center justify-center w-10 h-10 rounded-full transition-colors',
                isNotificationsOpen ? 'bg-surface-hover' : 'hover:bg-surface-hover'
              )}
            >
              <Bell className="w-5 h-5 text-text-secondary" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold bg-primary text-white rounded-full">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            <NotificationPanel
              isOpen={isNotificationsOpen}
              onClose={() => setIsNotificationsOpen(false)}
            />
          </div>

          {/* User menu */}
          <Dropdown
            trigger={
              <Avatar
                src={activeProfile?.avatar}
                name={activeProfile?.name || user?.username}
                size="sm"
                className="cursor-pointer ring-2 ring-transparent hover:ring-primary transition-all"
              />
            }
            items={userMenuItems}
            onSelect={handleMenuSelect}
            align="right"
          />
        </div>
      </div>
    </header>
  );
}

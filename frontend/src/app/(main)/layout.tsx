'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar, Header } from '@/components/layout';
import { PiPPlayer } from '@/components/features/player';
import { useAuthStore, useProfileStore, useChannelStore } from '@/stores';
import { Spinner } from '@/components/ui';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const { fetchProfiles, activeProfile } = useProfileStore();
  const { fetchChannels, fetchPlaylists } = useChannelStore();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (user?.id) {
      fetchProfiles(user.id);
      fetchPlaylists(user.id);
      fetchChannels(user.id);
    }
  }, [user?.id, fetchProfiles, fetchPlaylists, fetchChannels]);

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="text-4xl font-bold text-primary">StreamVault</div>
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-background-primary">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
      {/* Picture-in-Picture Player */}
      <PiPPlayer />
    </div>
  );
}

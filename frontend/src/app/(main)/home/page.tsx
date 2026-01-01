'use client';

import { useMemo, useEffect } from 'react';
import { Plus, Tv } from 'lucide-react';
import Link from 'next/link';
import { ChannelCarousel } from '@/components/features/channels';
import { ChannelCard } from '@/components/features/channels';
import { Button } from '@/components/ui';
import { useChannelStore, useAuthStore, useThumbnailStore } from '@/stores';

export default function HomePage() {
  const { channels, playlists, isLoading } = useChannelStore();
  const { user } = useAuthStore();
  const { fetchThumbnailsBatch } = useThumbnailStore();

  // Preload thumbnails in parallel when channels are loaded
  useEffect(() => {
    if (channels.length > 0 && !isLoading) {
      // Prepare channels for batch loading (first 30 for initial load)
      const channelsToPreload = channels.slice(0, 30).map((ch) => ({
        id: ch.id,
        url: ch.url,
      }));
      fetchThumbnailsBatch(channelsToPreload, 6);
    }
  }, [channels, isLoading, fetchThumbnailsBatch]);

  const channelsByCategory = useMemo(() => {
    return channels.reduce((acc, channel) => {
      const category = channel.group_title || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(channel);
      return acc;
    }, {} as Record<string, typeof channels>);
  }, [channels]);

  const categories = Object.keys(channelsByCategory).sort();
  const featuredChannel = channels[0];

  // Empty state
  if (!isLoading && channels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <div className="w-24 h-24 rounded-full bg-surface flex items-center justify-center mb-6">
          <Tv className="w-12 h-12 text-text-muted" />
        </div>
        <h1 className="text-2xl font-bold text-text-primary mb-2">
          Welcome to StreamVault
        </h1>
        <p className="text-text-secondary text-center max-w-md mb-8">
          Get started by adding your first playlist. You can import M3U/M3U8 playlists
          from a URL or upload a file.
        </p>
        <Link href="/settings/playlists">
          <Button size="lg" leftIcon={<Plus className="w-5 h-5" />}>
            Add Your First Playlist
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-8">
      {/* Featured Channel (Hero) */}
      {featuredChannel && (
        <section className="relative mb-8 px-4 lg:px-6">
          <ChannelCard
            channel={featuredChannel}
            variant="featured"
            enableLiveThumbnail
            thumbnailRefreshInterval={120000}
          />
        </section>
      )}

      {/* Continue Watching - TODO: Implement with watch history */}
      {/* <ChannelCarousel title="Continue Watching" channels={[]} /> */}

      {/* Categories */}
      {categories.map((category) => (
        <ChannelCarousel
          key={category}
          title={category}
          channels={channelsByCategory[category]}
          isLoading={isLoading}
          enableLiveThumbnail
          thumbnailRefreshInterval={120000}
        />
      ))}

      {/* Empty categories message */}
      {categories.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <p className="text-text-secondary">
            No channels found. Try adding a playlist.
          </p>
        </div>
      )}
    </div>
  );
}

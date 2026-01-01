'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Heart, Share2, Info, Tv } from 'lucide-react';
import Link from 'next/link';
import { VideoPlayer } from '@/components/features/player';
import { ChannelCard } from '@/components/features/channels';
import { Button, Spinner, Badge, toast } from '@/components/ui';
import { useChannelStore, usePlayerStore, useProfileStore } from '@/stores';
import { collections } from '@/lib/pocketbase/client';
import type { Channel } from '@/types';

export default function WatchPage() {
  const params = useParams();
  const router = useRouter();
  const channelId = params.channelId as string;

  const { channels } = useChannelStore();
  const { setChannel, setOnWatchPage, showPip, hidePip, isPipActive } = usePlayerStore();
  const { activeProfile } = useProfileStore();

  const [channel, setCurrentChannel] = useState<Channel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteId, setFavoriteId] = useState<string | null>(null);

  // Mark that we're on the watch page - hide PiP when entering
  useEffect(() => {
    setOnWatchPage(true);
    hidePip();

    // When leaving the watch page, show PiP if there's an active channel
    return () => {
      setOnWatchPage(false);
      // Show PiP when navigating away (if video was playing)
      showPip();
    };
  }, [setOnWatchPage, hidePip, showPip]);

  // Find channel from store or fetch it
  useEffect(() => {
    const findChannel = async () => {
      setIsLoading(true);

      // Try to find in store first
      const found = channels.find((c) => c.id === channelId);
      if (found) {
        setCurrentChannel(found);
        setChannel(found);
        setIsLoading(false);
        return;
      }

      // If not in store, fetch from API
      try {
        const record = await collections.channels.getOne(channelId);
        const ch = record as unknown as Channel;
        setCurrentChannel(ch);
        setChannel(ch);
      } catch (error) {
        console.error('Channel not found:', error);
        toast.error('Channel not found');
        router.push('/browse');
      } finally {
        setIsLoading(false);
      }
    };

    if (channelId) {
      findChannel();
    }

    // Note: We don't reset the player state here anymore to allow PiP to continue
  }, [channelId, channels, setChannel, router]);

  // Record watch history
  useEffect(() => {
    const recordHistory = async () => {
      if (!activeProfile?.id || !channelId || !channel) return;

      try {
        // Check if already in history
        const existing = await collections.watchHistory.getFullList({
          filter: `profile ~ "${activeProfile.id}" && channel ~ "${channelId}"`,
        });

        if (existing.length > 0) {
          // Update watched_at time
          await collections.watchHistory.update(existing[0].id, {
            watched_at: new Date().toISOString(),
          });
        } else {
          // Create new history entry
          await collections.watchHistory.create({
            profile: activeProfile.id,
            channel: channelId,
            watched_at: new Date().toISOString(),
            duration: 0,
          });
        }
      } catch (error) {
        console.error('Error recording history:', error);
      }
    };

    recordHistory();
  }, [activeProfile?.id, channelId, channel]);

  // Check if channel is favorite
  useEffect(() => {
    const checkFavorite = async () => {
      if (!activeProfile?.id || !channelId) return;

      try {
        const records = await collections.favorites.getFullList({
          filter: `profile ~ "${activeProfile.id}" && channel ~ "${channelId}"`,
        });
        if (records.length > 0) {
          setIsFavorite(true);
          setFavoriteId(records[0].id);
        } else {
          setIsFavorite(false);
          setFavoriteId(null);
        }
      } catch (error) {
        console.error('Error checking favorite:', error);
      }
    };

    checkFavorite();
  }, [activeProfile?.id, channelId]);

  // Related channels (same category)
  const relatedChannels = channels
    .filter((c) => c.id !== channelId && c.group_title === channel?.group_title)
    .slice(0, 8);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const toggleFavorite = async () => {
    if (!activeProfile?.id || !channelId) {
      toast.error('Please select a profile first');
      return;
    }

    try {
      if (isFavorite && favoriteId) {
        // Remove from favorites
        await collections.favorites.delete(favoriteId);
        setIsFavorite(false);
        setFavoriteId(null);
        toast.success('Removed from favorites');
      } else {
        // Add to favorites
        const record = await collections.favorites.create({
          profile: activeProfile.id,
          channel: channelId,
          sort_order: 0,
        });
        setIsFavorite(true);
        setFavoriteId(record.id);
        toast.success('Added to favorites');
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Failed to update favorites');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <div className="w-20 h-20 rounded-full bg-surface flex items-center justify-center mb-4">
          <Tv className="w-10 h-10 text-text-muted" />
        </div>
        <h2 className="text-xl font-semibold text-text-primary mb-2">
          Channel not found
        </h2>
        <p className="text-text-secondary mb-4">
          This channel may have been removed or the link is invalid.
        </p>
        <Link href="/browse">
          <Button>Browse Channels</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-8">
      {/* Back button */}
      <div className="px-4 lg:px-6 py-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
      </div>

      {/* Video Player */}
      <div className="px-0 lg:px-6">
        <div className="max-w-6xl mx-auto">
          <VideoPlayer channel={channel} autoPlay />
        </div>
      </div>

      {/* Channel Info */}
      <div className="px-4 lg:px-6 mt-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-start gap-6">
            {/* Main info */}
            <div className="flex-1">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-2xl font-bold text-text-primary">
                      {channel.custom_name || channel.name}
                    </h1>
                    {channel.quality && (
                      <Badge variant="primary">{channel.quality}</Badge>
                    )}
                  </div>
                  <p className="text-text-secondary">{channel.group_title}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 mt-4">
                <Button
                  variant={isFavorite ? 'primary' : 'secondary'}
                  onClick={toggleFavorite}
                  leftIcon={
                    <Heart
                      className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`}
                    />
                  }
                >
                  {isFavorite ? 'Favorited' : 'Add to Favorites'}
                </Button>
                <Button variant="secondary" onClick={handleShare}>
                  <Share2 className="w-5 h-5" />
                </Button>
                <Button variant="secondary">
                  <Info className="w-5 h-5" />
                </Button>
              </div>

              {/* Description/Details */}
              <div className="mt-6 p-4 bg-surface rounded-lg">
                <h3 className="text-sm font-semibold text-text-muted uppercase mb-3">
                  Channel Details
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-text-muted">Category:</span>
                    <span className="text-text-primary ml-2">
                      {channel.group_title}
                    </span>
                  </div>
                  {channel.language && (
                    <div>
                      <span className="text-text-muted">Language:</span>
                      <span className="text-text-primary ml-2">
                        {channel.language}
                      </span>
                    </div>
                  )}
                  {channel.country && (
                    <div>
                      <span className="text-text-muted">Country:</span>
                      <span className="text-text-primary ml-2">
                        {channel.country}
                      </span>
                    </div>
                  )}
                  {channel.quality && (
                    <div>
                      <span className="text-text-muted">Quality:</span>
                      <span className="text-text-primary ml-2">
                        {channel.quality}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Related Channels */}
          {relatedChannels.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xl font-semibold text-text-primary mb-4">
                More in {channel.group_title}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {relatedChannels.map((related) => (
                  <ChannelCard
                    key={related.id}
                    channel={related}
                    enableLiveThumbnail
                    thumbnailRefreshInterval={120000}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

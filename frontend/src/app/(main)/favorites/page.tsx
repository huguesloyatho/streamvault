'use client';

import { useState, useEffect } from 'react';
import { Heart, Tv } from 'lucide-react';
import { ChannelCard } from '@/components/features/channels';
import { Spinner } from '@/components/ui';
import { useProfileStore, useAuthStore } from '@/stores';
import { collections } from '@/lib/pocketbase/client';
import type { Channel, Favorite } from '@/types';

export default function FavoritesPage() {
  const { activeProfile } = useProfileStore();
  const { user } = useAuthStore();
  const [favorites, setFavorites] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFavorites = async () => {
      if (!activeProfile?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const records = await collections.favorites.getFullList({
          filter: `profile ~ "${activeProfile.id}"`,
          sort: 'sort_order',
        });

        // Fetch channels manually since expand doesn't work well with JSON array relations
        const channelPromises = records.map(async (fav) => {
          const channelId = Array.isArray(fav.channel) ? fav.channel[0] : fav.channel;
          if (!channelId) return null;
          try {
            const channel = await collections.channels.getOne(channelId);
            return channel as unknown as Channel;
          } catch {
            return null;
          }
        });

        const channels = (await Promise.all(channelPromises)).filter(
          (c): c is Channel => c !== null
        );

        setFavorites(channels);
      } catch (error) {
        console.error('Error fetching favorites:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFavorites();
  }, [activeProfile?.id]);

  const handleRemoveFavorite = async (channelId: string) => {
    if (!activeProfile?.id) return;

    try {
      const records = await collections.favorites.getFullList({
        filter: `profile ~ "${activeProfile.id}" && channel ~ "${channelId}"`,
      });

      if (records.length > 0) {
        await collections.favorites.delete(records[0].id);
        setFavorites(favorites.filter((f) => f.id !== channelId));
      }
    } catch (error) {
      console.error('Error removing favorite:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Heart className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Favorites</h1>
          <p className="text-text-secondary">
            {favorites.length} channel{favorites.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {favorites.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-20 h-20 rounded-full bg-surface flex items-center justify-center mb-4">
            <Tv className="w-10 h-10 text-text-muted" />
          </div>
          <h3 className="text-lg font-medium text-text-primary mb-2">
            No favorites yet
          </h3>
          <p className="text-text-secondary text-center max-w-sm">
            Start adding channels to your favorites by clicking the heart icon
            while watching
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {favorites.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              isFavorite
              onToggleFavorite={handleRemoveFavorite}
            />
          ))}
        </div>
      )}
    </div>
  );
}

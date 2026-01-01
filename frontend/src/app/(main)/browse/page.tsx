'use client';

import { useMemo, useState, useEffect } from 'react';
import { Grid, List, Filter, Search, Tv } from 'lucide-react';
import { ChannelCard } from '@/components/features/channels';
import { Button, Input, Select, ChannelCardSkeleton } from '@/components/ui';
import { useChannelStore, useThumbnailStore } from '@/stores';
import { cn } from '@/lib/utils';

type ViewMode = 'grid' | 'list';

export default function BrowsePage() {
  const { channels, isLoading, searchQuery, setSearchQuery, selectedCategory, setSelectedCategory } = useChannelStore();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const { fetchThumbnailsBatch } = useThumbnailStore();

  const categories = useMemo(() => {
    const cats = new Set<string>();
    channels.forEach((channel) => {
      if (channel.group_title) {
        cats.add(channel.group_title);
      }
    });
    return ['All', ...Array.from(cats).sort()];
  }, [channels]);

  const filteredChannels = useMemo(() => {
    let result = channels;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.group_title.toLowerCase().includes(query) ||
          c.tvg_name?.toLowerCase().includes(query)
      );
    }

    if (selectedCategory && selectedCategory !== 'All') {
      result = result.filter((c) => c.group_title === selectedCategory);
    }

    return result;
  }, [channels, searchQuery, selectedCategory]);

  // Preload thumbnails in parallel for visible channels
  useEffect(() => {
    if (filteredChannels.length > 0 && !isLoading && viewMode === 'grid') {
      // Preload first 24 visible channels (4 rows of 6)
      const channelsToPreload = filteredChannels.slice(0, 24).map((ch) => ({
        id: ch.id,
        url: ch.url,
      }));
      fetchThumbnailsBatch(channelsToPreload, 6);
    }
  }, [filteredChannels, isLoading, viewMode, fetchThumbnailsBatch]);

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Browse Channels</h1>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="flex-1">
            <Input
              placeholder="Search channels..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-5 h-5" />}
            />
          </div>

          {/* Category filter */}
          <Select
            value={selectedCategory || 'All'}
            options={categories.map((cat) => ({ label: cat, value: cat }))}
            onChange={(value) => setSelectedCategory(value === 'All' ? null : value)}
            className="w-full sm:w-48"
          />

          {/* View toggle */}
          <div className="flex items-center gap-1 bg-surface rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-2 rounded-md transition-colors',
                viewMode === 'grid'
                  ? 'bg-surface-hover text-primary'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              <Grid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-2 rounded-md transition-colors',
                viewMode === 'list'
                  ? 'bg-surface-hover text-primary'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-text-muted mb-4">
        {filteredChannels.length} channel{filteredChannels.length !== 1 ? 's' : ''} found
      </p>

      {/* Loading state */}
      {isLoading ? (
        <div className={cn(
          viewMode === 'grid'
            ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4'
            : 'flex flex-col gap-2'
        )}>
          {Array.from({ length: 12 }).map((_, i) => (
            <ChannelCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredChannels.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-20 h-20 rounded-full bg-surface flex items-center justify-center mb-4">
            <Tv className="w-10 h-10 text-text-muted" />
          </div>
          <h3 className="text-lg font-medium text-text-primary mb-2">
            No channels found
          </h3>
          <p className="text-text-secondary text-center max-w-sm">
            {searchQuery
              ? `No channels match "${searchQuery}"`
              : 'Add a playlist to see channels here'}
          </p>
          {searchQuery && (
            <Button
              variant="secondary"
              className="mt-4"
              onClick={() => setSearchQuery('')}
            >
              Clear search
            </Button>
          )}
        </div>
      ) : (
        /* Channel grid/list */
        <div
          className={cn(
            viewMode === 'grid'
              ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4'
              : 'flex flex-col gap-2'
          )}
        >
          {filteredChannels.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              variant={viewMode === 'list' ? 'compact' : 'default'}
              enableLiveThumbnail={viewMode === 'grid'}
              thumbnailRefreshInterval={120000}
            />
          ))}
        </div>
      )}
    </div>
  );
}

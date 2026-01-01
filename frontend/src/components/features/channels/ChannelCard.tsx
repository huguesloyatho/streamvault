'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Play, Heart, Info, Tv } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge, LiveThumbnail } from '@/components/ui';
import type { Channel } from '@/types';

interface ChannelCardProps {
  channel: Channel;
  isFavorite?: boolean;
  onToggleFavorite?: (channelId: string) => void;
  variant?: 'default' | 'compact' | 'featured';
  /**
   * Enable live thumbnails from the stream
   */
  enableLiveThumbnail?: boolean;
  /**
   * Refresh interval for live thumbnails in milliseconds
   */
  thumbnailRefreshInterval?: number;
}

export function ChannelCard({
  channel,
  isFavorite = false,
  onToggleFavorite,
  variant = 'default',
  enableLiveThumbnail = false,
  thumbnailRefreshInterval = 5 * 60 * 1000, // 5 minutes default
}: ChannelCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);

  const displayName = channel.custom_name || channel.name;
  const displayLogo = channel.custom_logo || channel.tvg_logo;

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleFavorite?.(channel.id);
  };

  if (variant === 'compact') {
    return (
      <Link
        href={`/watch/${channel.id}`}
        className="flex items-center gap-3 p-2 rounded-lg bg-surface hover:bg-surface-hover transition-colors group"
      >
        <div className="relative w-12 h-12 rounded-md overflow-hidden bg-background-tertiary flex-shrink-0">
          {displayLogo && !imageError ? (
            <Image
              src={displayLogo}
              alt={displayName}
              fill
              className="object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="flex items-center justify-center w-full h-full">
              <Tv className="w-6 h-6 text-text-muted" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary truncate group-hover:text-primary transition-colors">
            {displayName}
          </p>
          <p className="text-xs text-text-muted truncate">{channel.group_title}</p>
        </div>
        <Play className="w-4 h-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
      </Link>
    );
  }

  if (variant === 'featured') {
    return (
      <Link
        href={`/watch/${channel.id}`}
        className="block relative aspect-video rounded-xl overflow-hidden group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent z-10" />

        {enableLiveThumbnail ? (
          <LiveThumbnail
            channelId={channel.id}
            channelName={displayName}
            streamUrl={channel.url}
            fallbackLogo={displayLogo}
            className={cn(
              'absolute inset-0 transition-transform duration-500',
              isHovered && 'scale-110'
            )}
            refreshInterval={thumbnailRefreshInterval}
            showLiveIndicator={false} // Featured cards have their own badge
            lazyLoad={false} // Featured cards should load immediately
            enableRefresh={isHovered}
          />
        ) : displayLogo && !imageError ? (
          <Image
            src={displayLogo}
            alt={displayName}
            fill
            className={cn(
              'object-cover transition-transform duration-500',
              isHovered && 'scale-110'
            )}
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-background-tertiary to-background-secondary flex items-center justify-center">
            <Tv className="w-20 h-20 text-text-muted" />
          </div>
        )}

        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-6 z-20">
          <Badge variant="primary" className="mb-3">
            {channel.quality || 'HD'}
          </Badge>
          <h3 className="text-2xl font-bold text-white mb-2">{displayName}</h3>
          <p className="text-text-secondary mb-4">{channel.group_title}</p>

          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-6 py-2 bg-white text-black rounded-md font-semibold hover:bg-white/90 transition-colors">
              <Play className="w-5 h-5 fill-current" />
              Play
            </button>
            <button
              onClick={handleFavoriteClick}
              className={cn(
                'p-2 rounded-full border transition-colors',
                isFavorite
                  ? 'bg-primary border-primary'
                  : 'border-white/50 hover:border-white'
              )}
            >
              <Heart
                className={cn('w-5 h-5', isFavorite ? 'fill-white text-white' : 'text-white')}
              />
            </button>
            <button className="p-2 rounded-full border border-white/50 hover:border-white transition-colors">
              <Info className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </Link>
    );
  }

  // Default variant
  return (
    <Link
      href={`/watch/${channel.id}`}
      className="block relative aspect-video rounded-lg overflow-hidden group card-hover"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background - Live Thumbnail or Static Logo */}
      {enableLiveThumbnail ? (
        <LiveThumbnail
          channelId={channel.id}
          channelName={displayName}
          streamUrl={channel.url}
          fallbackLogo={displayLogo}
          className={cn(
            'absolute inset-0 transition-transform duration-300',
            isHovered && 'scale-110'
          )}
          refreshInterval={thumbnailRefreshInterval}
          showLiveIndicator={true}
          lazyLoad={true}
          enableRefresh={isHovered}
        />
      ) : displayLogo && !imageError ? (
        <Image
          src={displayLogo}
          alt={displayName}
          fill
          className={cn(
            'object-cover transition-transform duration-300',
            isHovered && 'scale-110'
          )}
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-background-tertiary to-background-secondary flex items-center justify-center">
          <Tv className="w-12 h-12 text-text-muted" />
        </div>
      )}

      {/* Gradient overlay */}
      <div className="gradient-overlay" />

      {/* Quality badge */}
      {channel.quality && (
        <Badge
          variant={channel.quality === '4K' ? 'primary' : 'default'}
          size="sm"
          className="absolute top-2 right-2 z-10"
        >
          {channel.quality}
        </Badge>
      )}

      {/* Play button on hover */}
      <div
        className={cn(
          'absolute inset-0 flex items-center justify-center z-10 transition-opacity duration-200',
          isHovered ? 'opacity-100' : 'opacity-0'
        )}
      >
        <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg transform hover:scale-110 transition-transform">
          <Play className="w-7 h-7 text-black fill-current ml-1" />
        </div>
      </div>

      {/* Favorite button */}
      {onToggleFavorite && (
        <button
          onClick={handleFavoriteClick}
          className={cn(
            'absolute top-2 left-2 z-20 p-1.5 rounded-full transition-all',
            isHovered ? 'opacity-100' : 'opacity-0',
            isFavorite ? 'bg-primary' : 'bg-black/50 hover:bg-black/70'
          )}
        >
          <Heart
            className={cn(
              'w-4 h-4',
              isFavorite ? 'fill-white text-white' : 'text-white'
            )}
          />
        </button>
      )}

      {/* Channel info */}
      <div className="absolute bottom-0 left-0 right-0 p-3 z-10">
        <h3 className="text-sm font-medium text-white truncate">{displayName}</h3>
        <p className="text-xs text-text-secondary truncate">{channel.group_title}</p>
      </div>
    </Link>
  );
}

'use client';

import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChannelCard } from './ChannelCard';
import { ChannelCardSkeleton } from '@/components/ui';
import type { Channel } from '@/types';

interface ChannelCarouselProps {
  title: string;
  channels: Channel[];
  isLoading?: boolean;
  favorites?: string[];
  onToggleFavorite?: (channelId: string) => void;
  enableLiveThumbnail?: boolean;
  thumbnailRefreshInterval?: number;
}

export function ChannelCarousel({
  title,
  channels,
  isLoading = false,
  favorites = [],
  onToggleFavorite,
  enableLiveThumbnail = false,
  thumbnailRefreshInterval = 120000,
}: ChannelCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScrollButtons = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = scrollContainerRef.current.clientWidth * 0.8;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
      setTimeout(checkScrollButtons, 300);
    }
  };

  if (isLoading) {
    return (
      <section className="py-4">
        <h2 className="text-xl font-semibold text-text-primary px-4 lg:px-6 mb-4">
          {title}
        </h2>
        <div className="flex gap-3 px-4 lg:px-6 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-[200px] lg:w-[280px]">
              <ChannelCardSkeleton />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (channels.length === 0) {
    return null;
  }

  return (
    <section className="py-4 group/carousel">
      {/* Title */}
      <h2 className="text-xl font-semibold text-text-primary px-4 lg:px-6 mb-4 flex items-center gap-2">
        {title}
        <span className="text-sm font-normal text-text-muted">
          ({channels.length})
        </span>
      </h2>

      {/* Carousel container */}
      <div className="relative">
        {/* Left scroll button */}
        <button
          onClick={() => scroll('left')}
          className={cn(
            'carousel-nav left-0',
            canScrollLeft
              ? 'group-hover/carousel:opacity-100'
              : 'opacity-0 pointer-events-none'
          )}
          aria-label="Scroll left"
        >
          <div className="w-10 h-10 rounded-full bg-background-secondary/90 flex items-center justify-center hover:bg-surface-hover transition-colors">
            <ChevronLeft className="w-6 h-6 text-text-primary" />
          </div>
        </button>

        {/* Channels container */}
        <div
          ref={scrollContainerRef}
          onScroll={checkScrollButtons}
          className="flex gap-3 px-4 lg:px-6 overflow-x-auto scrollbar-hide scroll-smooth"
        >
          {channels.map((channel) => (
            <div
              key={channel.id}
              className="flex-shrink-0 w-[160px] sm:w-[200px] lg:w-[280px]"
            >
              <ChannelCard
                channel={channel}
                isFavorite={favorites.includes(channel.id)}
                onToggleFavorite={onToggleFavorite}
                enableLiveThumbnail={enableLiveThumbnail}
                thumbnailRefreshInterval={thumbnailRefreshInterval}
              />
            </div>
          ))}
        </div>

        {/* Right scroll button */}
        <button
          onClick={() => scroll('right')}
          className={cn(
            'carousel-nav right',
            canScrollRight
              ? 'group-hover/carousel:opacity-100'
              : 'opacity-0 pointer-events-none'
          )}
          aria-label="Scroll right"
        >
          <div className="w-10 h-10 rounded-full bg-background-secondary/90 flex items-center justify-center hover:bg-surface-hover transition-colors">
            <ChevronRight className="w-6 h-6 text-text-primary" />
          </div>
        </button>
      </div>
    </section>
  );
}

'use client';

import { cn } from '@/lib/utils';

export interface SkeletonProps {
  className?: string;
  variant?: 'rectangular' | 'circular' | 'text';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'shimmer' | 'none';
}

export function Skeleton({
  className,
  variant = 'rectangular',
  width,
  height,
  animation = 'shimmer',
}: SkeletonProps) {
  const variants = {
    rectangular: 'rounded-md',
    circular: 'rounded-full',
    text: 'rounded h-4',
  };

  const animations = {
    pulse: 'animate-pulse',
    shimmer: 'bg-shimmer bg-[length:200%_100%] animate-shimmer',
    none: '',
  };

  return (
    <div
      className={cn(
        'bg-surface-hover',
        variants[variant],
        animations[animation],
        className
      )}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    />
  );
}

// Card Skeleton
export function CardSkeleton() {
  return (
    <div className="bg-surface rounded-lg overflow-hidden">
      <Skeleton className="w-full aspect-video" />
      <div className="p-4 space-y-3">
        <Skeleton variant="text" className="w-3/4" />
        <Skeleton variant="text" className="w-1/2" />
      </div>
    </div>
  );
}

// Channel Card Skeleton
export function ChannelCardSkeleton() {
  return (
    <div className="relative aspect-video bg-surface rounded-lg overflow-hidden">
      <Skeleton className="absolute inset-0" />
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 to-transparent">
        <Skeleton variant="text" className="w-2/3 h-5" />
        <Skeleton variant="text" className="w-1/3 h-3 mt-1" />
      </div>
    </div>
  );
}

// Profile Skeleton
export function ProfileSkeleton() {
  return (
    <div className="flex flex-col items-center gap-2">
      <Skeleton variant="circular" width={80} height={80} />
      <Skeleton variant="text" width={60} />
    </div>
  );
}

// Sidebar Item Skeleton
export function SidebarItemSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Skeleton variant="circular" width={24} height={24} />
      <Skeleton variant="text" className="flex-1" />
    </div>
  );
}

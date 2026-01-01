'use client';

import { forwardRef } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { getInitials } from '@/lib/utils';

export interface AvatarProps {
  src?: string | null;
  alt?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  onClick?: () => void;
}

const sizes = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
  xl: 'w-16 h-16 text-xl',
  '2xl': 'w-24 h-24 text-2xl',
};

const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ src, alt = 'Avatar', name, size = 'md', className, onClick }, ref) => {
    const initials = name ? getInitials(name) : '?';

    return (
      <div
        ref={ref}
        className={cn(
          'relative flex items-center justify-center rounded-full overflow-hidden bg-surface-hover',
          sizes[size],
          onClick && 'cursor-pointer hover:ring-2 hover:ring-primary transition-all',
          className
        )}
        onClick={onClick}
      >
        {src ? (
          <Image
            src={src}
            alt={alt}
            fill
            className="object-cover"
            sizes={size === '2xl' ? '96px' : size === 'xl' ? '64px' : '48px'}
          />
        ) : (
          <span className="font-medium text-text-primary select-none">
            {initials}
          </span>
        )}
      </div>
    );
  }
);

Avatar.displayName = 'Avatar';

export { Avatar };

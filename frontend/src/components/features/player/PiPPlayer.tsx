'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Hls from 'hls.js';
import {
  Play,
  Pause,
  X,
  Maximize2,
  Volume2,
  VolumeX,
  Loader2,
  GripVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePlayerStore } from '@/stores';

type PipPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

export function PiPPlayer() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isBuffering, setIsBuffering] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [position, setPosition] = useState<PipPosition>('bottom-right');
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [customPosition, setCustomPosition] = useState<{ x: number; y: number } | null>(null);

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    isPipVisible,
    pipChannel,
    isPlaying,
    isPaused,
    isMuted,
    volume,
    shouldAutoPlayPip,
    closePip,
    setPlaying,
    setPaused,
    setMuted,
    hidePip,
  } = usePlayerStore();

  // Initialize HLS player when PiP becomes visible
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !pipChannel?.url || !isPipVisible) return;

    const initPlayer = () => {
      // Destroy existing instance
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 30,
          maxBufferLength: 15,
          maxMaxBufferLength: 30,
          startLevel: -1,
        });

        hls.loadSource(pipChannel.url);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          // Only auto-play if video was playing before transition to PiP
          if (shouldAutoPlayPip) {
            video.play().catch(() => {
              setPaused(true);
            });
          } else {
            // Keep video paused
            setPaused(true);
          }
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            console.error('PiP HLS Error:', data);
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              hls.startLoad();
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              hls.recoverMediaError();
            }
          }
        });

        hlsRef.current = hls;
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        video.src = pipChannel.url;
        if (shouldAutoPlayPip) {
          video.play().catch(() => setPaused(true));
        } else {
          setPaused(true);
        }
      }
    };

    initPlayer();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [pipChannel?.url, isPipVisible, shouldAutoPlayPip, setPaused]);

  // Sync volume and mute state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = isMuted;
  }, [volume, isMuted]);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setPlaying(true);
    const handlePause = () => setPaused(true);
    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => setIsBuffering(false);

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
    };
  }, [setPlaying, setPaused]);

  // Auto-hide controls
  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    setShowControls(true);
    controlsTimeoutRef.current = setTimeout(() => {
      if (!isPaused) {
        setShowControls(false);
      }
    }, 2500);
  }, [isPaused]);

  // Player controls
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(!isMuted);
  };

  // Navigate to full player view
  const handleMaximize = () => {
    if (pipChannel) {
      hidePip();
      router.push(`/watch/${pipChannel.id}`);
    }
  };

  // Handle close/stop
  const handleClose = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const video = videoRef.current;
    if (video) {
      video.pause();
      video.src = ''; // Clear the source
    }
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    closePip();
  };

  // Drag handling
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const x = e.clientX - dragOffset.x;
      const y = e.clientY - dragOffset.y;
      setCustomPosition({ x, y });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  // Position classes
  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-20 right-4',
    'top-left': 'top-20 left-4',
  };

  if (!isPipVisible || !pipChannel) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'fixed z-50 w-80 aspect-video bg-black rounded-lg overflow-hidden shadow-2xl border border-surface-hover',
        'transition-all duration-300 ease-out',
        'animate-in fade-in slide-in-from-bottom-4',
        isDragging ? 'cursor-grabbing shadow-xl scale-105' : 'cursor-default',
        !customPosition && positionClasses[position]
      )}
      style={
        customPosition
          ? {
              left: `${customPosition.x}px`,
              top: `${customPosition.y}px`,
            }
          : undefined
      }
      onMouseMove={resetControlsTimeout}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => !isPaused && setShowControls(false)}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        onClick={togglePlay}
      />

      {/* Loading indicator */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
        </div>
      )}

      {/* Controls overlay */}
      <div
        className={cn(
          'absolute inset-0 transition-opacity duration-200',
          showControls ? 'opacity-100' : 'opacity-0'
        )}
      >
        {/* Center play/pause button - z-10 so it's below top/bottom bars */}
        <button
          onClick={togglePlay}
          className="absolute inset-0 z-10 flex items-center justify-center group"
        >

          <div
            className={cn(
              'p-3 rounded-full bg-black/50 transition-transform',
              'group-hover:scale-110'
            )}
          >
            {isPaused ? (
              <Play className="w-6 h-6 text-white fill-current" />
            ) : (
              <Pause className="w-6 h-6 text-white fill-current" />
            )}
          </div>
        </button>

        {/* Top bar with channel name and close - z-20 so it's above center button */}
        <div className="absolute top-0 left-0 right-0 z-20 p-2 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between">
          {/* Drag handle */}
          <div
            className="flex items-center gap-2 cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
          >
            <GripVertical className="w-4 h-4 text-white/60" />
            <span className="text-white text-xs font-medium truncate max-w-[180px]">
              {pipChannel.custom_name || pipChannel.name}
            </span>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded hover:bg-white/20 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Bottom controls - z-20 so it's above center button */}
        <div className="absolute bottom-0 left-0 right-0 z-20 p-2 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Mute toggle */}
            <button
              onClick={toggleMute}
              className="p-1 rounded hover:bg-white/20 transition-colors"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-white" />
              ) : (
                <Volume2 className="w-4 h-4 text-white" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Maximize button */}
            <button
              onClick={handleMaximize}
              className="p-1 rounded hover:bg-white/20 transition-colors"
              title="Maximize"
            >
              <Maximize2 className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

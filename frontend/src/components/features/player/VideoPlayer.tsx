'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  SkipBack,
  SkipForward,
  Loader2,
  AlertCircle,
  RefreshCw,
  Circle,
  Square,
  PauseCircle,
  PlayCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/lib/utils';
import { usePlayerStore, useNotificationStore } from '@/stores';
import { useRecorder } from '@/hooks/useRecorder';
import { toast } from '@/components/ui';
import { SubtitleDisplay, SubtitleControls } from '@/components/features/subtitles';
import type { Channel } from '@/types';

interface VideoPlayerProps {
  channel: Channel;
  autoPlay?: boolean;
  onError?: (error: string) => void;
}

export function VideoPlayer({
  channel,
  autoPlay = true,
  onError,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  // Subtitle state
  const [subtitleSessionId, setSubtitleSessionId] = useState<string | null>(null);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false);
  const [waitingForSubtitles, setWaitingForSubtitles] = useState(false);

  const {
    isPlaying,
    isPaused,
    isBuffering,
    isMuted,
    isFullscreen,
    volume,
    currentTime,
    duration,
    quality,
    availableQualities,
    error,
    setPlaying,
    setPaused,
    setBuffering,
    setMuted,
    setFullscreen,
    setVolume,
    setCurrentTime,
    setDuration,
    setQuality,
    setAvailableQualities,
    setError,
  } = usePlayerStore();

  // Recording functionality
  const {
    status: recordingStatus,
    formattedDuration: recordingDuration,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    isRecording,
    isPaused: isRecordingPaused,
  } = useRecorder(channel.id, channel.url, channel.name);

  const { notify } = useNotificationStore();

  const handleStartRecording = async () => {
    try {
      await startRecording();
      toast.success('Recording started');
      notify.info('Recording Started', `Now recording "${channel.name}"`, {
        label: 'View recordings',
        href: '/recordings',
      });
    } catch (err) {
      toast.error('Failed to start recording');
      notify.error('Recording Failed', `Could not start recording "${channel.name}"`);
    }
  };

  const handlePauseRecording = async () => {
    try {
      await pauseRecording();
      toast.info('Recording paused');
    } catch (err) {
      toast.error('Failed to pause recording');
    }
  };

  const handleResumeRecording = async () => {
    try {
      await resumeRecording();
      toast.info('Recording resumed');
    } catch (err) {
      toast.error('Failed to resume recording');
    }
  };

  const handleStopRecording = async () => {
    const result = await stopRecording();
    if (result?.bytes_written) {
      const sizeMB = Math.round(result.bytes_written / 1024 / 1024);
      toast.success(`Recording saved (${sizeMB}MB)`);
      notify.success('Recording Saved', `"${channel.name}" recording saved (${sizeMB}MB)`, {
        label: 'View recordings',
        href: '/recordings',
      });
    } else {
      toast.success('Recording stopped');
      notify.success('Recording Stopped', `Recording of "${channel.name}" has been stopped`, {
        label: 'View recordings',
        href: '/recordings',
      });
    }
  };

  // Initialize HLS player
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !channel.url) return;

    const initPlayer = () => {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          startLevel: -1, // Auto quality
        });

        hls.loadSource(channel.url);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
          const qualities = data.levels.map((level, index) => ({
            label: `${level.height}p`,
            value: index.toString(),
          }));
          qualities.unshift({ label: 'Auto', value: 'auto' });
          setAvailableQualities(qualities.map((q) => q.label));

          if (autoPlay) {
            video.play().catch(() => {
              // Autoplay might be blocked
              setPaused(true);
            });
          }
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
          const level = hls.levels[data.level];
          if (level) {
            setQuality(`${level.height}p`);
          }
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                setError('Network error. Attempting to recover...');
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                setError('Media error. Attempting to recover...');
                hls.recoverMediaError();
                break;
              default:
                setError('An error occurred. Please try again.');
                onError?.(data.details);
                hls.destroy();
                break;
            }
          }
        });

        hlsRef.current = hls;
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        video.src = channel.url;
        if (autoPlay) {
          video.play().catch(() => setPaused(true));
        }
      } else {
        setError('HLS is not supported in this browser');
      }
    };

    initPlayer();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [channel.url, autoPlay, setAvailableQualities, setPaused, setQuality, setError, onError]);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => {
      setPlaying(true);
      setError(null);
    };

    const handlePause = () => {
      setPaused(true);
    };

    const handleWaiting = () => {
      setBuffering(true);
    };

    const handlePlaying = () => {
      setBuffering(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handleDurationChange = () => {
      setDuration(video.duration);
    };

    const handleVolumeChange = () => {
      setVolume(video.volume);
      setMuted(video.muted);
    };

    const handleEnded = () => {
      setPaused(true);
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('volumechange', handleVolumeChange);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('volumechange', handleVolumeChange);
      video.removeEventListener('ended', handleEnded);
    };
  }, [setPlaying, setPaused, setBuffering, setCurrentTime, setDuration, setVolume, setMuted, setError]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'arrowleft':
          e.preventDefault();
          seek(-10);
          break;
        case 'arrowright':
          e.preventDefault();
          seek(10);
          break;
        case 'arrowup':
          e.preventDefault();
          adjustVolume(0.1);
          break;
        case 'arrowdown':
          e.preventDefault();
          adjustVolume(-0.1);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-hide controls
  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    setShowControls(true);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !isPaused) {
        setShowControls(false);
      }
    }, 3000);
  }, [isPlaying, isPaused]);

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
  };

  const adjustVolume = (delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = Math.max(0, Math.min(1, video.volume + delta));
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const newVolume = parseFloat(e.target.value);
    video.volume = newVolume;
    video.muted = newVolume === 0;
  };

  const seek = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(duration, currentTime + seconds));
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container) return;

    try {
      const doc = document as Document & {
        webkitFullscreenElement?: Element;
        webkitExitFullscreen?: () => Promise<void>;
      };
      const elem = container as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
      };

      const isCurrentlyFullscreen = document.fullscreenElement || doc.webkitFullscreenElement;

      if (!isCurrentlyFullscreen) {
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) {
          await elem.webkitRequestFullscreen();
        } else if (video?.requestFullscreen) {
          await video.requestFullscreen();
        }
        setFullscreen(true);
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        }
        setFullscreen(false);
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element };
      const isFs = !!(document.fullscreenElement || doc.webkitFullscreenElement);
      setFullscreen(isFs);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [setFullscreen]);

  const handleQualityChange = (newQuality: string) => {
    if (!hlsRef.current) return;

    if (newQuality === 'Auto') {
      hlsRef.current.currentLevel = -1;
    } else {
      const levelIndex = hlsRef.current.levels.findIndex(
        (level) => `${level.height}p` === newQuality
      );
      if (levelIndex !== -1) {
        hlsRef.current.currentLevel = levelIndex;
      }
    }
    setShowSettings(false);
  };

  const retry = () => {
    setError(null);
    if (hlsRef.current) {
      hlsRef.current.startLoad();
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full aspect-video bg-black overflow-hidden group player-container',
        isFullscreen && 'fixed inset-0 z-50'
      )}
      onMouseMove={resetControlsTimeout}
      onMouseLeave={() => !isPaused && setShowControls(false)}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        onClick={togglePlay}
      />

      {/* Subtitle Display Overlay */}
      <SubtitleDisplay
        sessionId={subtitleSessionId}
        enabled={subtitlesEnabled}
        position="bottom"
        fontSize="medium"
        backgroundColor="semi"
        onWaitingForSync={() => {
          // Pause video while calibrating sync
          const video = videoRef.current;
          if (video && !video.paused) {
            video.pause();
            setWaitingForSubtitles(true);
            console.log('[VideoPlayer] Paused for subtitle sync calibration');
          }
        }}
        onSyncReady={(initialDelay) => {
          // Resume video when sync is calibrated
          const video = videoRef.current;
          if (video && waitingForSubtitles) {
            console.log(`[VideoPlayer] Sync ready with ${initialDelay}ms baseline delay. Resuming video.`);
            video.play();
            setWaitingForSubtitles(false);
          }
        }}
      />

      {/* Loading indicator */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <Loader2 className="w-12 h-12 text-white animate-spin" />
        </div>
      )}

      {/* Waiting for subtitles sync indicator */}
      {waitingForSubtitles && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
          <Loader2 className="w-10 h-10 text-primary animate-spin mb-3" />
          <p className="text-white text-lg font-medium">Calibration de la synchronisation...</p>
          <p className="text-white/70 text-sm mt-1">Analyse du délai de traitement (~10-15 sec)</p>
          <p className="text-white/50 text-xs mt-2">La vidéo reprendra automatiquement</p>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
          <AlertCircle className="w-12 h-12 text-error mb-4" />
          <p className="text-white text-lg mb-4">{error}</p>
          <button
            onClick={retry}
            className="flex items-center gap-2 px-4 py-2 bg-primary rounded-md text-white hover:bg-primary-hover transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      {/* Controls overlay */}
      <div
        className={cn(
          'player-controls z-20',
          showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
      >
        {/* Channel info - top gradient */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent">
          <h3 className="text-white text-lg font-semibold">
            {channel.custom_name || channel.name}
          </h3>
          <p className="text-white/70 text-sm">{channel.group_title}</p>
        </div>

        {/* Bottom controls */}
        <div className="flex items-center gap-4 relative z-30">
          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className="text-white hover:text-primary transition-colors"
          >
            {isPaused ? (
              <Play className="w-8 h-8 fill-current" />
            ) : (
              <Pause className="w-8 h-8 fill-current" />
            )}
          </button>

          {/* Skip buttons */}
          <button
            onClick={() => seek(-10)}
            className="text-white/80 hover:text-white transition-colors"
          >
            <SkipBack className="w-6 h-6" />
          </button>
          <button
            onClick={() => seek(10)}
            className="text-white/80 hover:text-white transition-colors"
          >
            <SkipForward className="w-6 h-6" />
          </button>

          {/* Time */}
          {duration > 0 && (
            <div className="text-white/80 text-sm">
              {formatDuration(currentTime)} / {formatDuration(duration)}
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Volume */}
          <div className="flex items-center gap-2 group/volume">
            <button
              onClick={toggleMute}
              className="text-white/80 hover:text-white transition-colors"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-6 h-6" />
              ) : (
                <Volume2 className="w-6 h-6" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-0 group-hover/volume:w-20 transition-all duration-200 accent-primary"
            />
          </div>

          {/* Recording controls */}
          <div className="flex items-center gap-1">
            {recordingStatus === 'idle' ? (
              <button
                onClick={handleStartRecording}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-white/80 hover:text-red-500 hover:bg-white/10 transition-colors"
                title="Start recording"
              >
                <Circle className="w-5 h-5 fill-red-500 text-red-500" />
              </button>
            ) : (
              <div className="flex items-center gap-1">
                {/* Recording indicator */}
                <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500/20 rounded">
                  <Circle className="w-3 h-3 fill-red-500 text-red-500 animate-pulse" />
                  <span className="text-red-400 text-xs font-mono">{recordingDuration}</span>
                </div>

                {/* Pause/Resume */}
                {isRecordingPaused ? (
                  <button
                    onClick={handleResumeRecording}
                    className="p-1.5 rounded text-white/80 hover:text-green-500 hover:bg-white/10 transition-colors"
                    title="Resume recording"
                  >
                    <PlayCircle className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    onClick={handlePauseRecording}
                    className="p-1.5 rounded text-white/80 hover:text-yellow-500 hover:bg-white/10 transition-colors"
                    title="Pause recording"
                  >
                    <PauseCircle className="w-5 h-5" />
                  </button>
                )}

                {/* Stop */}
                <button
                  onClick={handleStopRecording}
                  className="p-1.5 rounded text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                  title="Stop recording"
                >
                  <Square className="w-5 h-5 fill-current" />
                </button>
              </div>
            )}
          </div>

          {/* Subtitle controls */}
          <SubtitleControls
            channelId={channel.id}
            streamUrl={channel.url}
            onSessionChange={setSubtitleSessionId}
            onEnabledChange={setSubtitlesEnabled}
            enabled={subtitlesEnabled}
          />

          {/* Quality settings */}
          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="text-white/80 hover:text-white transition-colors"
            >
              <Settings className="w-6 h-6" />
            </button>
            {showSettings && (
              <div className="absolute bottom-full right-0 mb-2 py-2 bg-background-secondary rounded-lg shadow-xl min-w-[120px]">
                <p className="px-4 py-1 text-xs text-text-muted uppercase">Quality</p>
                {availableQualities.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleQualityChange(q)}
                    className={cn(
                      'w-full px-4 py-1.5 text-sm text-left hover:bg-surface-hover transition-colors',
                      quality === q ? 'text-primary' : 'text-text-primary'
                    )}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="text-white/80 hover:text-white transition-colors"
          >
            {isFullscreen ? (
              <Minimize className="w-6 h-6" />
            ) : (
              <Maximize className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

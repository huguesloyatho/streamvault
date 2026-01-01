'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface SubtitleEntry {
  id: number;
  start_time: number;
  end_time: number;
  text: string;
  language?: string;
  processing_time?: number;
}

interface SubtitleDisplayProps {
  sessionId: string | null;
  enabled: boolean;
  position?: 'bottom' | 'top';
  fontSize?: 'small' | 'medium' | 'large';
  backgroundColor?: 'transparent' | 'semi' | 'solid';
  className?: string;
  onSyncReady?: (initialDelay: number) => void; // Called when sync is calibrated with required delay
  onWaitingForSync?: () => void; // Called when starting calibration
}

const POCKETBASE_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://localhost:8090';

// Sync configuration
const CALIBRATION_SAMPLES = 3; // Number of samples to calibrate sync
const SYNC_MARGIN = 2000; // 2 seconds safety margin
const MAX_DRIFT_MS = 1500; // Max drift before skipping subtitles to resync
const SUBTITLE_INTERVAL_MS = 3000; // Expected interval between subtitles (3s buffer)

export function SubtitleDisplay({
  sessionId,
  enabled,
  position = 'bottom',
  fontSize = 'medium',
  backgroundColor = 'semi',
  className,
  onSyncReady,
  onWaitingForSync,
}: SubtitleDisplayProps) {
  const [currentSubtitle, setCurrentSubtitle] = useState<SubtitleEntry | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const lastSubIdRef = useRef(0);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const displayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const syncNotifiedRef = useRef(false);
  const waitingNotifiedRef = useRef(false);

  // Sync tracking - use ref for syncStatus to avoid closure issues
  const syncStatusRef = useRef<'calibrating' | 'synced' | 'drifting'>('calibrating');
  const calibrationSamplesRef = useRef<number[]>([]); // Processing times for calibration
  const syncBaselineRef = useRef<number>(0); // Calculated sync delay
  const lastSubtitleTimeRef = useRef<number>(0); // Track subtitle arrival times
  const videoStartTimeRef = useRef<number>(0); // When video started after sync

  const fontSizes = {
    small: 'text-sm',
    medium: 'text-lg',
    large: 'text-2xl',
  };

  const backgrounds = {
    transparent: 'bg-transparent',
    semi: 'bg-black/60',
    solid: 'bg-black',
  };

  const positions = {
    bottom: 'bottom-16 left-1/2 -translate-x-1/2',
    top: 'top-16 left-1/2 -translate-x-1/2',
  };

  // Store callbacks in refs to avoid recreating interval
  const onSyncReadyRef = useRef(onSyncReady);
  const onWaitingForSyncRef = useRef(onWaitingForSync);
  onSyncReadyRef.current = onSyncReady;
  onWaitingForSyncRef.current = onWaitingForSync;

  // Poll for subtitles
  useEffect(() => {
    if (enabled && sessionId) {
      console.log(`[Sync] Starting polling for session ${sessionId}`);

      // Notify parent that we're starting calibration
      if (!waitingNotifiedRef.current) {
        waitingNotifiedRef.current = true;
        onWaitingForSyncRef.current?.();
      }

      const poll = async () => {
        if (!sessionId || !enabled) return;

        try {
          const token = localStorage.getItem('pocketbase_auth');
          const authData = token ? JSON.parse(token) : null;

          const response = await fetch(
            `${POCKETBASE_URL}/api/subtitle/session/${sessionId}/subtitles?since=${lastSubIdRef.current}`,
            {
              headers: {
                Authorization: authData?.token ? `Bearer ${authData.token}` : '',
              },
            }
          );

          if (!response.ok) return;

          const data = await response.json();

          if (data.subtitles && data.subtitles.length > 0) {
            const now = Date.now();

            for (const sub of data.subtitles) {
              if (sub.id <= lastSubIdRef.current) continue;
              lastSubIdRef.current = sub.id;

              // Track arrival time for drift detection
              const timeSinceLastSub = lastSubtitleTimeRef.current > 0
                ? now - lastSubtitleTimeRef.current
                : 0;
              lastSubtitleTimeRef.current = now;

              console.log(`[Sync] Received subtitle id=${sub.id}, status=${syncStatusRef.current}, text="${sub.text.substring(0, 30)}..."`);

              // Calibration phase - collect processing times
              if (syncStatusRef.current === 'calibrating') {
                const processingTime = sub.processing_time || 2000;
                calibrationSamplesRef.current.push(processingTime);

                console.log(`[Sync] Calibration sample ${calibrationSamplesRef.current.length}/${CALIBRATION_SAMPLES}: ${processingTime}ms`);

                if (calibrationSamplesRef.current.length >= CALIBRATION_SAMPLES) {
                  const maxProcessingTime = Math.max(...calibrationSamplesRef.current);
                  const baseline = maxProcessingTime + SYNC_MARGIN;

                  console.log(`[Sync] Calibration complete. Processing times: ${calibrationSamplesRef.current.join(', ')}ms`);
                  console.log(`[Sync] Max processing: ${maxProcessingTime}ms + margin: ${SYNC_MARGIN}ms = ${baseline}ms`);

                  syncBaselineRef.current = baseline;
                  videoStartTimeRef.current = now;
                  syncStatusRef.current = 'synced';
                  console.log(`[Sync] Status changed to 'synced' - will display all future subtitles`);

                  if (!syncNotifiedRef.current) {
                    syncNotifiedRef.current = true;
                    onSyncReadyRef.current?.(baseline);
                  }
                }
              } else if (syncStatusRef.current === 'synced') {
                // Display subtitle immediately - video and subtitles are now in sync
                console.log(`[Sync] Displaying subtitle: "${sub.text.substring(0, 50)}..."`);
                setCurrentSubtitle(sub);
                setIsVisible(true);

                if (displayTimeoutRef.current) clearTimeout(displayTimeoutRef.current);
                const displayDuration = Math.min(8000, Math.max(2500, sub.text.length * 70));
                displayTimeoutRef.current = setTimeout(() => setIsVisible(false), displayDuration);

                // Monitor for drift
                if (timeSinceLastSub > SUBTITLE_INTERVAL_MS + MAX_DRIFT_MS) {
                  console.log(`[Sync] Warning: subtitle delayed ${timeSinceLastSub}ms (expected ~${SUBTITLE_INTERVAL_MS}ms)`);
                }
              }
            }
          }
        } catch (error) {
          console.error('Failed to fetch subtitles:', error);
        }
      };

      pollIntervalRef.current = setInterval(poll, 500);
      poll(); // Initial fetch

      return () => {
        console.log(`[Sync] Stopping polling for session ${sessionId}`);
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      };
    }
  }, [enabled, sessionId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (displayTimeoutRef.current) {
        clearTimeout(displayTimeoutRef.current);
      }
    };
  }, []);

  // Reset when session changes
  useEffect(() => {
    console.log(`[Sync] Session changed to ${sessionId}, resetting state`);
    lastSubIdRef.current = 0;
    syncNotifiedRef.current = false;
    waitingNotifiedRef.current = false;
    calibrationSamplesRef.current = [];
    syncBaselineRef.current = 0;
    lastSubtitleTimeRef.current = 0;
    videoStartTimeRef.current = 0;
    syncStatusRef.current = 'calibrating';
    setCurrentSubtitle(null);
    setIsVisible(false);
  }, [sessionId]);

  if (!enabled || !currentSubtitle || !isVisible) {
    return null;
  }

  return (
    <div
      className={cn(
        'absolute z-50 max-w-[80%] px-4 py-2 rounded-lg transition-opacity duration-300',
        positions[position],
        backgrounds[backgroundColor],
        fontSizes[fontSize],
        'text-white text-center font-medium shadow-lg',
        isVisible ? 'opacity-100' : 'opacity-0',
        className
      )}
    >
      {currentSubtitle.text}
    </div>
  );
}

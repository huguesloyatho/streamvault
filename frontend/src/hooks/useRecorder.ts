import { useState, useCallback, useEffect } from 'react';
import pb from '@/lib/pocketbase/client';

export type RecordingStatus = 'idle' | 'recording' | 'paused' | 'stopping';

interface RecordingInfo {
  id: string;
  channel_url: string;
  output_path: string;
  status: string;
  started_at: string;
  paused_at?: string;
  stopped_at?: string;
  bytes_written: number;
  segments: number;
  duration_seconds: number;
}

export function useRecorder(channelId: string, channelUrl: string, channelName: string) {
  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [recordingInfo, setRecordingInfo] = useState<RecordingInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);

  // Generate unique recording ID
  const recordingId = `rec_${channelId}_${Date.now()}`;
  const [currentRecordingId, setCurrentRecordingId] = useState<string | null>(null);

  // Update duration every second when recording
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (status === 'recording') {
      interval = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [status]);

  const startRecording = useCallback(async () => {
    setError(null);
    const newRecordingId = `rec_${channelId}_${Date.now()}`;

    try {
      const response = await fetch(`${pb.baseUrl}/api/recorder/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pb.authStore.token}`,
        },
        body: JSON.stringify({
          recording_id: newRecordingId,
          channel_url: channelUrl,
          title: channelName,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to start recording');
      }

      const data = await response.json();
      setRecordingInfo(data);
      setCurrentRecordingId(newRecordingId);
      setStatus('recording');
      setDuration(0);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  }, [channelId, channelUrl, channelName]);

  const pauseRecording = useCallback(async () => {
    if (!currentRecordingId) return;
    setError(null);

    try {
      const response = await fetch(`${pb.baseUrl}/api/recorder/pause`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pb.authStore.token}`,
        },
        body: JSON.stringify({
          recording_id: currentRecordingId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to pause recording');
      }

      const data = await response.json();
      setRecordingInfo(data);
      setStatus('paused');
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  }, [currentRecordingId]);

  const resumeRecording = useCallback(async () => {
    if (!currentRecordingId) return;
    setError(null);

    try {
      const response = await fetch(`${pb.baseUrl}/api/recorder/resume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pb.authStore.token}`,
        },
        body: JSON.stringify({
          recording_id: currentRecordingId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to resume recording');
      }

      const data = await response.json();
      setRecordingInfo(data);
      setStatus('recording');
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  }, [currentRecordingId]);

  const stopRecording = useCallback(async () => {
    if (!currentRecordingId) {
      // Reset state even if no recording ID
      setStatus('idle');
      setDuration(0);
      return { stopped: true, message: 'No active recording' };
    }
    setError(null);
    setStatus('stopping');

    try {
      const response = await fetch(`${pb.baseUrl}/api/recorder/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pb.authStore.token}`,
        },
        body: JSON.stringify({
          recording_id: currentRecordingId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        // If recording not found, just reset state - don't throw
        if (data.message?.includes('not found') || data.message?.includes('Failed to stop')) {
          setStatus('idle');
          setCurrentRecordingId(null);
          setDuration(0);
          // Return a success-like response - the file was likely already saved
          return { stopped: true, message: 'Recording stopped' };
        }
        throw new Error(data.message || 'Failed to stop recording');
      }

      const data = await response.json();
      setRecordingInfo(data);
      setStatus('idle');
      setCurrentRecordingId(null);
      setDuration(0);
      return data;
    } catch (err) {
      // Don't throw on stop errors - just reset state
      setError(null);
      setStatus('idle');
      setCurrentRecordingId(null);
      setDuration(0);
      return { stopped: true, message: 'Recording stopped' };
    }
  }, [currentRecordingId]);

  const formatDuration = useCallback((seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return {
    status,
    recordingInfo,
    error,
    duration,
    formattedDuration: formatDuration(duration),
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    isRecording: status === 'recording',
    isPaused: status === 'paused',
    isIdle: status === 'idle',
  };
}

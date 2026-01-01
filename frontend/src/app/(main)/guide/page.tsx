'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Play,
  Radio,
  X,
  Info,
  Tv,
} from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useChannelStore, useAuthStore } from '@/stores';
import type { Channel, EPGProgram } from '@/types';

// Time slot configuration
const SLOT_MINUTES = 30;
const SLOT_WIDTH = 180; // pixels per 30-minute slot
const HOURS_TO_SHOW = 24;
const CHANNEL_HEIGHT = 80;
const CHANNEL_SIDEBAR_WIDTH = 200;

// Generate demo programs for a channel
function generateDemoPrograms(
  channel: Channel,
  date: Date
): EPGProgram[] {
  const programs: EPGProgram[] = [];
  const programTypes = [
    { title: 'Morning News', duration: 60, category: 'News' },
    { title: 'Weather Report', duration: 30, category: 'News' },
    { title: 'Talk Show', duration: 90, category: 'Entertainment' },
    { title: 'Documentary', duration: 60, category: 'Documentary' },
    { title: 'Movie', duration: 120, category: 'Movie' },
    { title: 'Sports Live', duration: 180, category: 'Sports' },
    { title: 'Comedy Series', duration: 30, category: 'Series' },
    { title: 'Drama', duration: 60, category: 'Series' },
    { title: 'Kids Show', duration: 30, category: 'Kids' },
    { title: 'Music Hour', duration: 60, category: 'Music' },
    { title: 'Late Night Show', duration: 90, category: 'Entertainment' },
    { title: 'News Update', duration: 30, category: 'News' },
  ];

  // Seed random based on channel id and date for consistency
  const seed = channel.id.charCodeAt(0) + date.getDate();
  let pseudoRandom = seed;
  const random = () => {
    pseudoRandom = (pseudoRandom * 9301 + 49297) % 233280;
    return pseudoRandom / 233280;
  };

  let currentTime = new Date(date);
  currentTime.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  while (currentTime < endOfDay) {
    const programType = programTypes[Math.floor(random() * programTypes.length)];
    const startTime = new Date(currentTime);
    const endTime = new Date(currentTime.getTime() + programType.duration * 60 * 1000);

    programs.push({
      id: `${channel.id}_${startTime.getTime()}`,
      source: 'demo',
      channel_id: channel.tvg_id || channel.id,
      title: programType.title,
      description: `This is a demo ${programType.category.toLowerCase()} program.`,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      category: programType.category,
      created: new Date().toISOString(),
    });

    currentTime = endTime;
  }

  return programs;
}

// Format time for display
function formatTime(date: Date): string {
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Format date for display
function formatDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

// Calculate program position and width
function calculateProgramStyle(
  program: EPGProgram,
  timelineStart: Date
): { left: number; width: number } {
  const startTime = new Date(program.start_time);
  const endTime = new Date(program.end_time);

  const startMinutes =
    (startTime.getTime() - timelineStart.getTime()) / (1000 * 60);
  const durationMinutes =
    (endTime.getTime() - startTime.getTime()) / (1000 * 60);

  const left = (startMinutes / SLOT_MINUTES) * SLOT_WIDTH;
  const width = (durationMinutes / SLOT_MINUTES) * SLOT_WIDTH;

  return { left: Math.max(0, left), width: Math.max(SLOT_WIDTH / 2, width) };
}

// Get category color
function getCategoryColor(category?: string): string {
  const colors: Record<string, string> = {
    News: 'bg-blue-500/20 border-blue-500/50 text-blue-300',
    Sports: 'bg-green-500/20 border-green-500/50 text-green-300',
    Movie: 'bg-purple-500/20 border-purple-500/50 text-purple-300',
    Series: 'bg-orange-500/20 border-orange-500/50 text-orange-300',
    Documentary: 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300',
    Entertainment: 'bg-pink-500/20 border-pink-500/50 text-pink-300',
    Kids: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300',
    Music: 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300',
  };
  return colors[category || ''] || 'bg-surface-hover border-border text-text-primary';
}

interface ProgramDetailsModalProps {
  program: EPGProgram;
  channel: Channel;
  onClose: () => void;
  onWatch: () => void;
}

function ProgramDetailsModal({
  program,
  channel,
  onClose,
  onWatch,
}: ProgramDetailsModalProps) {
  const startTime = new Date(program.start_time);
  const endTime = new Date(program.end_time);
  const isLive = new Date() >= startTime && new Date() <= endTime;
  const isPast = new Date() > endTime;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <Card
        variant="bordered"
        padding="lg"
        className="w-full max-w-lg relative animate-in fade-in zoom-in-95 duration-200"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full hover:bg-surface-hover"
        >
          <X className="w-5 h-5 text-text-secondary" />
        </button>

        <div className="flex items-start gap-4 mb-4">
          <div className="w-16 h-16 rounded-lg bg-surface-hover flex items-center justify-center flex-shrink-0">
            {channel.tvg_logo ? (
              <img
                src={channel.tvg_logo}
                alt={channel.name}
                className="w-12 h-12 object-contain"
              />
            ) : (
              <Tv className="w-8 h-8 text-text-muted" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-text-secondary mb-1">{channel.name}</p>
            <h2 className="text-xl font-bold text-text-primary mb-1">
              {program.title}
            </h2>
            <div className="flex items-center gap-2">
              {isLive && (
                <span className="px-2 py-0.5 text-xs font-medium bg-primary text-white rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                  LIVE
                </span>
              )}
              {program.category && (
                <span className="text-xs text-text-muted">{program.category}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-4 text-sm text-text-secondary">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            <span>
              {formatTime(startTime)} - {formatTime(endTime)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4" />
            <span>{formatDate(startTime)}</span>
          </div>
        </div>

        {program.description && (
          <p className="text-text-secondary mb-6">{program.description}</p>
        )}

        <div className="flex gap-3">
          {isLive && (
            <Button onClick={onWatch} leftIcon={<Play className="w-4 h-4" />}>
              Watch Now
            </Button>
          )}
          {!isPast && !isLive && (
            <Button variant="secondary" leftIcon={<Radio className="w-4 h-4" />}>
              Schedule Recording
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default function GuidePage() {
  const router = useRouter();
  const { channels } = useChannelStore();
  const { user } = useAuthStore();
  const gridRef = useRef<HTMLDivElement>(null);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedProgram, setSelectedProgram] = useState<{
    program: EPGProgram;
    channel: Channel;
  } | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Deduplicate channels by URL to avoid showing the same stream multiple times
  const uniqueChannels = useMemo(() => {
    const seen = new Set<string>();
    return channels.filter((channel) => {
      if (seen.has(channel.url)) {
        return false;
      }
      seen.add(channel.url);
      return true;
    });
  }, [channels]);

  // Fetch channels on mount if needed
  useEffect(() => {
    const { fetchChannels } = useChannelStore.getState();
    if (user?.id && uniqueChannels.length === 0) {
      fetchChannels(user.id);
    }
  }, [user?.id, uniqueChannels.length]);

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Generate timeline slots
  const timelineStart = useMemo(() => {
    const start = new Date(selectedDate);
    start.setHours(0, 0, 0, 0);
    return start;
  }, [selectedDate]);

  const timeSlots = useMemo(() => {
    const slots: Date[] = [];
    const slotsCount = (HOURS_TO_SHOW * 60) / SLOT_MINUTES;
    for (let i = 0; i < slotsCount; i++) {
      const time = new Date(timelineStart.getTime() + i * SLOT_MINUTES * 60 * 1000);
      slots.push(time);
    }
    return slots;
  }, [timelineStart]);

  // Generate programs for all channels
  const channelPrograms = useMemo(() => {
    const programsMap: Record<string, EPGProgram[]> = {};
    uniqueChannels.slice(0, 50).forEach((channel) => {
      programsMap[channel.id] = generateDemoPrograms(channel, selectedDate);
    });
    return programsMap;
  }, [uniqueChannels, selectedDate]);

  // Calculate now indicator position
  const nowIndicatorPosition = useMemo(() => {
    const now = currentTime;
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);

    if (now.toDateString() !== selectedDate.toDateString()) {
      return null;
    }

    const minutesSinceStart = (now.getTime() - startOfDay.getTime()) / (1000 * 60);
    return (minutesSinceStart / SLOT_MINUTES) * SLOT_WIDTH;
  }, [currentTime, selectedDate]);

  // Scroll to now on mount
  useEffect(() => {
    if (gridRef.current && nowIndicatorPosition !== null) {
      const scrollPos = nowIndicatorPosition - gridRef.current.clientWidth / 3;
      gridRef.current.scrollLeft = Math.max(0, scrollPos);
    }
  }, [nowIndicatorPosition]);

  const navigateDate = (direction: 'prev' | 'next') => {
    setSelectedDate((prev) => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
      return newDate;
    });
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const handleProgramClick = (program: EPGProgram, channel: Channel) => {
    setSelectedProgram({ program, channel });
  };

  const handleWatch = () => {
    if (selectedProgram) {
      router.push(`/watch/${selectedProgram.channel.id}`);
    }
  };

  const displayedChannels = uniqueChannels.slice(0, 50);

  if (uniqueChannels.length === 0) {
    return (
      <div className="p-4 lg:p-6">
        <h1 className="text-2xl font-bold text-text-primary mb-6">TV Guide (EPG)</h1>

        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-20 h-20 rounded-full bg-surface flex items-center justify-center mb-4">
            <Calendar className="w-10 h-10 text-text-muted" />
          </div>
          <h3 className="text-lg font-medium text-text-primary mb-2">
            No channels available
          </h3>
          <p className="text-text-secondary text-center max-w-sm mb-4">
            Add a playlist in settings to see the TV guide for your channels
          </p>
          <Button onClick={() => router.push('/settings/playlists')}>
            Add Playlist
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-var(--header-height))] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-background-primary">
        <h1 className="text-xl font-bold text-text-primary">TV Guide</h1>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigateDate('prev')}
            leftIcon={<ChevronLeft className="w-4 h-4" />}
          >
            Previous
          </Button>

          <Button
            variant={selectedDate.toDateString() === new Date().toDateString() ? 'primary' : 'secondary'}
            size="sm"
            onClick={goToToday}
          >
            Today
          </Button>

          <span className="px-3 py-1.5 text-sm font-medium text-text-primary bg-surface rounded-lg">
            {formatDate(selectedDate)}
          </span>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigateDate('next')}
            rightIcon={<ChevronRight className="w-4 h-4" />}
          >
            Next
          </Button>
        </div>
      </div>

      {/* Guide Grid */}
      <div className="flex-1 flex overflow-hidden">
        {/* Channel sidebar */}
        <div
          className="flex-shrink-0 border-r border-border bg-background-primary z-10"
          style={{ width: CHANNEL_SIDEBAR_WIDTH }}
        >
          {/* Time header spacer */}
          <div className="h-10 border-b border-border bg-surface" />

          {/* Channel list */}
          <div className="overflow-y-auto" style={{ height: `calc(100% - 40px)` }}>
            {displayedChannels.map((channel) => (
              <div
                key={channel.id}
                className="flex items-center gap-3 px-3 border-b border-border hover:bg-surface-hover cursor-pointer"
                style={{ height: CHANNEL_HEIGHT }}
                onClick={() => router.push(`/watch/${channel.id}`)}
              >
                <div className="w-10 h-10 rounded-lg bg-surface-hover flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {channel.tvg_logo ? (
                    <img
                      src={channel.tvg_logo}
                      alt={channel.name}
                      className="w-8 h-8 object-contain"
                    />
                  ) : (
                    <Tv className="w-5 h-5 text-text-muted" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {channel.name}
                  </p>
                  <p className="text-xs text-text-muted truncate">
                    {channel.group_title}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline grid */}
        <div ref={gridRef} className="flex-1 overflow-auto">
          {/* Time header */}
          <div className="sticky top-0 z-10 flex h-10 bg-surface border-b border-border">
            {timeSlots.map((slot, index) => (
              <div
                key={index}
                className="flex-shrink-0 flex items-center justify-start px-2 border-r border-border/50 text-sm text-text-secondary"
                style={{ width: SLOT_WIDTH }}
              >
                {formatTime(slot)}
              </div>
            ))}
          </div>

          {/* Programs grid */}
          <div className="relative" style={{ width: timeSlots.length * SLOT_WIDTH }}>
            {/* Now indicator */}
            {nowIndicatorPosition !== null && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-primary z-20 pointer-events-none"
                style={{ left: nowIndicatorPosition }}
              >
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-primary text-white text-xs font-medium rounded">
                  NOW
                </div>
              </div>
            )}

            {/* Channel rows */}
            {displayedChannels.map((channel) => (
              <div
                key={channel.id}
                className="relative border-b border-border"
                style={{ height: CHANNEL_HEIGHT }}
              >
                {/* Time slot backgrounds */}
                <div className="absolute inset-0 flex">
                  {timeSlots.map((_, index) => (
                    <div
                      key={index}
                      className="flex-shrink-0 border-r border-border/30"
                      style={{ width: SLOT_WIDTH }}
                    />
                  ))}
                </div>

                {/* Programs */}
                {channelPrograms[channel.id]?.map((program) => {
                  const { left, width } = calculateProgramStyle(program, timelineStart);
                  const isNowPlaying =
                    new Date() >= new Date(program.start_time) &&
                    new Date() <= new Date(program.end_time);

                  return (
                    <button
                      key={program.id}
                      onClick={() => handleProgramClick(program, channel)}
                      className={cn(
                        'absolute top-1 bottom-1 rounded-lg border px-2 py-1 overflow-hidden text-left transition-all hover:ring-2 hover:ring-primary/50',
                        getCategoryColor(program.category),
                        isNowPlaying && 'ring-2 ring-primary'
                      )}
                      style={{ left, width: width - 4 }}
                    >
                      <p className="text-sm font-medium truncate">{program.title}</p>
                      <p className="text-xs opacity-75 truncate">
                        {formatTime(new Date(program.start_time))} -{' '}
                        {formatTime(new Date(program.end_time))}
                      </p>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Demo notice */}
      <div className="flex items-center justify-center gap-2 p-2 bg-surface border-t border-border">
        <Info className="w-4 h-4 text-text-muted" />
        <p className="text-sm text-text-muted">
          Demo EPG data shown. Add an EPG source in settings to see real program schedules.
        </p>
      </div>

      {/* Program details modal */}
      {selectedProgram && (
        <ProgramDetailsModal
          program={selectedProgram.program}
          channel={selectedProgram.channel}
          onClose={() => setSelectedProgram(null)}
          onWatch={handleWatch}
        />
      )}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { History, Tv, Trash2 } from 'lucide-react';
import { ChannelCard } from '@/components/features/channels';
import { Button, Spinner, ConfirmDialog } from '@/components/ui';
import { useProfileStore } from '@/stores';
import { collections } from '@/lib/pocketbase/client';
import type { Channel } from '@/types';
import Link from 'next/link';

interface WatchHistoryItem {
  id: string;
  channel: Channel;
  watched_at: string;
}

export default function HistoryPage() {
  const { activeProfile } = useProfileStore();
  const [history, setHistory] = useState<WatchHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!activeProfile?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const records = await collections.watchHistory.getFullList({
          filter: `profile ~ "${activeProfile.id}"`,
          sort: '-watched_at',
        });

        // Fetch channels manually
        const historyItems: WatchHistoryItem[] = [];
        for (const record of records) {
          const channelId = Array.isArray(record.channel) ? record.channel[0] : record.channel;
          if (!channelId) continue;
          try {
            const channel = await collections.channels.getOne(channelId);
            historyItems.push({
              id: record.id,
              channel: channel as unknown as Channel,
              watched_at: record.watched_at as string,
            });
          } catch {
            // Channel may have been deleted
          }
        }

        setHistory(historyItems);
      } catch (error) {
        console.error('Error fetching history:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [activeProfile?.id]);

  const handleClearHistory = async () => {
    if (!activeProfile?.id) return;

    setIsClearing(true);
    try {
      const records = await collections.watchHistory.getFullList({
        filter: `profile ~ "${activeProfile.id}"`,
      });

      for (const record of records) {
        await collections.watchHistory.delete(record.id);
      }

      setHistory([]);
      setShowClearConfirm(false);
    } catch (error) {
      console.error('Error clearing history:', error);
    } finally {
      setIsClearing(false);
    }
  };

  const handleRemoveItem = async (historyId: string) => {
    try {
      await collections.watchHistory.delete(historyId);
      setHistory(history.filter((h) => h.id !== historyId));
    } catch (error) {
      console.error('Error removing history item:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <History className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Watch History</h1>
            <p className="text-text-secondary">
              {history.length} channel{history.length !== 1 ? 's' : ''} watched
            </p>
          </div>
        </div>
        {history.length > 0 && (
          <Button variant="ghost" onClick={() => setShowClearConfirm(true)}>
            <Trash2 className="w-4 h-4 mr-2" />
            Clear History
          </Button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-20 h-20 rounded-full bg-surface flex items-center justify-center mb-4">
            <Tv className="w-10 h-10 text-text-muted" />
          </div>
          <h3 className="text-lg font-medium text-text-primary mb-2">
            No watch history yet
          </h3>
          <p className="text-text-secondary text-center max-w-sm mb-4">
            Channels you watch will appear here so you can easily find them again
          </p>
          <Link href="/browse">
            <Button>Browse Channels</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {history.map((item) => (
            <ChannelCard
              key={item.id}
              channel={item.channel}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={handleClearHistory}
        title="Clear Watch History"
        message="Are you sure you want to clear your entire watch history? This action cannot be undone."
        confirmText="Clear History"
        cancelText="Cancel"
        variant="danger"
        isLoading={isClearing}
      />
    </div>
  );
}

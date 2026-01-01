'use client';

import { useState, useMemo } from 'react';
import { Search as SearchIcon, Tv } from 'lucide-react';
import { ChannelCard } from '@/components/features/channels';
import { Input } from '@/components/ui';
import { useChannelStore } from '@/stores';

export default function SearchPage() {
  const { channels } = useChannelStore();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return channels.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.group_title?.toLowerCase().includes(q) ||
        c.tvg_name?.toLowerCase().includes(q)
    );
  }, [channels, query]);

  return (
    <div className="p-4 lg:p-6">
      <h1 className="text-2xl font-bold text-text-primary mb-6">Search</h1>

      <div className="max-w-2xl mb-8">
        <Input
          placeholder="Search channels..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          leftIcon={<SearchIcon className="w-5 h-5" />}
          autoFocus
        />
      </div>

      {query.trim() ? (
        results.length > 0 ? (
          <div>
            <p className="text-sm text-text-muted mb-4">
              {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {results.map((channel) => (
                <ChannelCard key={channel.id} channel={channel} />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-20 h-20 rounded-full bg-surface flex items-center justify-center mb-4">
              <Tv className="w-10 h-10 text-text-muted" />
            </div>
            <h3 className="text-lg font-medium text-text-primary mb-2">
              No results found
            </h3>
            <p className="text-text-secondary">
              No channels match "{query}"
            </p>
          </div>
        )
      ) : (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-20 h-20 rounded-full bg-surface flex items-center justify-center mb-4">
            <SearchIcon className="w-10 h-10 text-text-muted" />
          </div>
          <h3 className="text-lg font-medium text-text-primary mb-2">
            Search for channels
          </h3>
          <p className="text-text-secondary">
            Enter a channel name or category to search
          </p>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Calendar,
  Trash2,
  RefreshCw,
  ExternalLink,
  Clock,
  AlertCircle,
  Check,
  Globe,
} from 'lucide-react';
import { Card, Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import pb from '@/lib/pocketbase/client';
import { useAuthStore } from '@/stores';
import type { EPGSource } from '@/types';

interface EPGSourceFormData {
  name: string;
  url: string;
  sync_interval: number;
}

export default function EPGSettingsPage() {
  const { user } = useAuthStore();
  const [sources, setSources] = useState<EPGSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingSource, setIsAddingSource] = useState(false);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const [formData, setFormData] = useState<EPGSourceFormData>({
    name: '',
    url: '',
    sync_interval: 24,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      fetchSources();
    }
  }, [user?.id]);

  const fetchSources = async () => {
    try {
      const records = await pb.collection('epg_sources').getFullList({
        filter: `user = "${user?.id}"`,
        sort: '-created',
      });
      setSources(records as unknown as EPGSource[]);
    } catch (err) {
      console.error('Error fetching EPG sources:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim() || !formData.url.trim()) {
      setError('Name and URL are required');
      return;
    }

    try {
      const record = await pb.collection('epg_sources').create({
        user: user?.id,
        name: formData.name.trim(),
        url: formData.url.trim(),
        sync_interval: formData.sync_interval,
        is_active: true,
      });
      setSources((prev) => [record as unknown as EPGSource, ...prev]);
      setFormData({ name: '', url: '', sync_interval: 24 });
      setIsAddingSource(false);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDeleteSource = async (id: string) => {
    if (!confirm('Are you sure you want to delete this EPG source?')) {
      return;
    }

    try {
      await pb.collection('epg_sources').delete(id);
      setSources((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error('Error deleting EPG source:', err);
    }
  };

  const handleToggleActive = async (source: EPGSource) => {
    try {
      const updated = await pb.collection('epg_sources').update(source.id, {
        is_active: !source.is_active,
      });
      setSources((prev) =>
        prev.map((s) => (s.id === source.id ? (updated as unknown as EPGSource) : s))
      );
    } catch (err) {
      console.error('Error updating EPG source:', err);
    }
  };

  const handleSyncSource = async (source: EPGSource) => {
    setIsSyncing(source.id);
    try {
      // Call the sync API endpoint
      const response = await fetch(`${pb.baseUrl}/api/epg/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pb.authStore.token}`,
        },
        body: JSON.stringify({ source_id: source.id }),
      });

      if (!response.ok) {
        throw new Error('Failed to sync EPG source');
      }

      // Update the last_synced timestamp locally
      const updated = await pb.collection('epg_sources').getOne(source.id);
      setSources((prev) =>
        prev.map((s) => (s.id === source.id ? (updated as unknown as EPGSource) : s))
      );
    } catch (err) {
      console.error('Error syncing EPG source:', err);
    } finally {
      setIsSyncing(null);
    }
  };

  const formatLastSync = (timestamp?: string) => {
    if (!timestamp) return 'Never synced';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/settings"
          className="p-2 rounded-lg hover:bg-surface-hover transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-text-secondary" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">EPG Sources</h1>
          <p className="text-sm text-text-secondary">
            Manage Electronic Program Guide data sources
          </p>
        </div>
      </div>

      {/* Info Card */}
      <Card variant="bordered" padding="md" className="mb-6 bg-primary/5 border-primary/20">
        <div className="flex gap-3">
          <Calendar className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-text-primary mb-1">
              What is EPG?
            </h3>
            <p className="text-sm text-text-secondary">
              EPG (Electronic Program Guide) provides TV schedule information for your
              channels. Add XMLTV sources to see program schedules, descriptions, and
              recording options in the TV Guide.
            </p>
          </div>
        </div>
      </Card>

      {/* Add Source Button */}
      {!isAddingSource && (
        <Button
          onClick={() => setIsAddingSource(true)}
          leftIcon={<Plus className="w-4 h-4" />}
          className="mb-6"
        >
          Add EPG Source
        </Button>
      )}

      {/* Add Source Form */}
      {isAddingSource && (
        <Card variant="bordered" padding="md" className="mb-6">
          <h3 className="text-lg font-medium text-text-primary mb-4">
            Add New EPG Source
          </h3>
          <form onSubmit={handleAddSource} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                Source Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="e.g., TV Guide France"
                className="w-full h-10 px-3 bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                XMLTV URL
              </label>
              <input
                type="url"
                value={formData.url}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, url: e.target.value }))
                }
                placeholder="https://example.com/epg.xml"
                className="w-full h-10 px-3 bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                Sync Interval (hours)
              </label>
              <select
                value={formData.sync_interval}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    sync_interval: parseInt(e.target.value),
                  }))
                }
                className="w-full h-10 px-3 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value={6}>Every 6 hours</option>
                <option value={12}>Every 12 hours</option>
                <option value={24}>Every 24 hours</option>
                <option value={48}>Every 48 hours</option>
              </select>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-500">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="submit">Add Source</Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setIsAddingSource(false);
                  setFormData({ name: '', url: '', sync_interval: 24 });
                  setError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Sources List */}
      <h2 className="text-lg font-semibold text-text-primary mb-4">
        Your EPG Sources
      </h2>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Card key={i} variant="bordered" padding="md">
              <div className="animate-pulse flex items-center gap-4">
                <div className="w-10 h-10 bg-surface-hover rounded-lg" />
                <div className="flex-1">
                  <div className="h-4 bg-surface-hover rounded w-1/3 mb-2" />
                  <div className="h-3 bg-surface-hover rounded w-1/2" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : sources.length === 0 ? (
        <Card variant="bordered" padding="lg">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-surface-hover flex items-center justify-center mb-4">
              <Globe className="w-8 h-8 text-text-muted" />
            </div>
            <h3 className="text-lg font-medium text-text-primary mb-2">
              No EPG Sources
            </h3>
            <p className="text-text-secondary max-w-sm mb-4">
              Add an XMLTV source to get TV program schedules for your channels.
            </p>
            {!isAddingSource && (
              <Button
                onClick={() => setIsAddingSource(true)}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Add EPG Source
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {sources.map((source) => (
            <Card key={source.id} variant="bordered" padding="md">
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                    source.is_active ? 'bg-green-500/10' : 'bg-surface-hover'
                  )}
                >
                  <Calendar
                    className={cn(
                      'w-5 h-5',
                      source.is_active ? 'text-green-500' : 'text-text-muted'
                    )}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base font-medium text-text-primary">
                      {source.name}
                    </h3>
                    {source.is_active ? (
                      <span className="px-1.5 py-0.5 text-xs font-medium bg-green-500/10 text-green-500 rounded">
                        Active
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 text-xs font-medium bg-surface-hover text-text-muted rounded">
                        Inactive
                      </span>
                    )}
                  </div>

                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-text-secondary hover:text-primary truncate flex items-center gap-1 mb-2"
                  >
                    <span className="truncate">{source.url}</span>
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>

                  <div className="flex items-center gap-4 text-xs text-text-muted">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Syncs every {source.sync_interval}h</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>{formatLastSync(source.last_synced)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleSyncSource(source)}
                    disabled={isSyncing === source.id}
                    leftIcon={
                      <RefreshCw
                        className={cn(
                          'w-4 h-4',
                          isSyncing === source.id && 'animate-spin'
                        )}
                      />
                    }
                  >
                    Sync
                  </Button>

                  <button
                    onClick={() => handleToggleActive(source)}
                    className={cn(
                      'p-2 rounded-lg transition-colors',
                      source.is_active
                        ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
                        : 'bg-surface-hover text-text-muted hover:text-text-primary'
                    )}
                    title={source.is_active ? 'Disable source' : 'Enable source'}
                  >
                    <Check className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDeleteSource(source.id)}
                    className="p-2 rounded-lg bg-surface-hover text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    title="Delete source"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Popular Sources */}
      <h2 className="text-lg font-semibold text-text-primary mt-8 mb-4">
        Popular EPG Sources
      </h2>
      <Card variant="bordered" padding="md">
        <div className="space-y-3">
          {[
            {
              name: 'EPG.pw',
              url: 'https://epg.pw',
              description: 'Free XMLTV EPG for many countries',
            },
            {
              name: 'IPTV-ORG EPG',
              url: 'https://iptv-org.github.io/epg',
              description: 'Open source EPG data',
            },
            {
              name: 'WebGrab+Plus',
              url: 'http://www.webgrabplus.com',
              description: 'Multi-source grabber software',
            },
          ].map((suggestion) => (
            <div
              key={suggestion.name}
              className="flex items-center justify-between py-2 border-b border-border last:border-0"
            >
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {suggestion.name}
                </p>
                <p className="text-xs text-text-muted">{suggestion.description}</p>
              </div>
              <a
                href={suggestion.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                Visit
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
